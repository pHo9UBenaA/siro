import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { createHash } from 'node:crypto';

const workflow = parse(
  readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/publish.yaml'), 'utf8'),
);

it('does not expose OIDC to install/build/verification and transfers one exact artifact', () => {
  const buildSteps = workflow.jobs.build.steps as { run?: string; uses?: string }[];
  const pack = buildSteps.findIndex((step) => step.run?.includes('pnpm test:package'));
  const identity = buildSteps.findIndex((step) => step.run?.includes('scripts/check-release.mjs'));
  const upload = buildSteps.findIndex((step) => step.uses?.startsWith('actions/upload-artifact'));
  expect(pack).toBeGreaterThanOrEqual(0);
  expect(identity).toBeGreaterThan(pack);
  expect(upload).toBeGreaterThan(identity);
  expect(workflow.permissions['id-token']).toBeUndefined();
  expect(workflow.jobs.build.permissions['id-token']).toBeUndefined();
  expect(workflow.jobs.publish.needs).toBe('build');
  expect(workflow.jobs.publish.permissions['id-token']).toBe('write');
  const steps = workflow.jobs.publish.steps as {
    uses?: string;
    run?: string;
    with?: Record<string, string>;
  }[];
  expect(steps.some((step) => step.uses?.startsWith('actions/checkout'))).toBe(false);
  expect(steps.map((step) => step.run ?? '').join('\n')).not.toMatch(
    /pnpm|scripts\/|npm install|npm run|npm pack/,
  );
  expect(steps.map((step) => step.run ?? '').join('\n')).toContain('sha256sum --check --strict');
  expect(steps.map((step) => step.run ?? '').join('\n')).toContain('npm stage publish');
  expect(
    steps.find((step) => step.uses?.startsWith('actions/download-artifact'))?.with?.[
      'artifact-ids'
    ],
  ).toContain('needs.build.outputs.artifactId');
  const actions = (Object.values(workflow.jobs) as { steps: { uses?: string }[] }[])
    .flatMap((job) => job.steps)
    .map((step) => step.uses)
    .filter((uses): uses is string => uses !== undefined);
  for (const action of actions) expect(action).toMatch(/@[a-f0-9]{40}$/);
});

it('only stages the bytes matching the build checksum', (context) => {
  if (process.platform !== 'linux') {
    context.skip();
    return;
  }
  const root = mkdtempSync(path.join(tmpdir(), 'siro-stage-boundary-'));
  const script = workflow.jobs.publish.steps.find((step: { run?: string }) =>
    step.run?.includes('npm stage publish'),
  ).run;
  try {
    mkdirSync(path.join(root, 'bin'));
    mkdirSync(path.join(root, 'release'));
    writeFileSync(
      path.join(root, 'bin/npm'),
      '#!/bin/sh\ntest "$1" = stage && test "$2" = publish && cp "$3" "$RUNNER_TEMP/staged"\n',
      { mode: 0o755 },
    );
    const execute = (sha: string) =>
      spawnSync('bash', ['-c', script], {
        encoding: 'utf8',
        timeout: 10000,
        env: {
          PATH: `${path.join(root, 'bin')}:${process.env.PATH}`,
          RUNNER_TEMP: root,
          ARTIFACT_SHA256: sha,
        },
      });
    const artifact = path.join(root, 'release/siro.tgz');
    const bytes = 'verified artifact';
    const digest = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(artifact, bytes);
    expect(execute('not-a-digest').status).not.toBe(0);
    writeFileSync(artifact, 'substituted artifact');
    expect(execute(digest).status).not.toBe(0);
    rmSync(artifact);
    expect(execute(digest).status).not.toBe(0);
    expect(() => readFileSync(path.join(root, 'staged'))).toThrow(/ENOENT/);
    writeFileSync(artifact, bytes);
    const valid = execute(digest);
    expect(valid.error).toBeUndefined();
    expect(valid.status).toBe(0);
    expect(readFileSync(path.join(root, 'staged'), 'utf8')).toBe(bytes);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('rejects invalid packed identity, mismatched tags and commits outside main', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'siro-release-check-'));
  const script = path.resolve(import.meta.dirname, '../../scripts/check-release.mjs');
  // Hooks export GIT_DIR/GIT_INDEX_FILE/config overrides. Never let a temporary
  // fixture inherit the invoking repository's metadata or mutate its config/refs.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
  );
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10000, env });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    return result.stdout.trim();
  };
  const artifact = path.join(root, 'siro artifact & spaces.tgz');
  const archive = (raw: string) => {
    writeFileSync(path.join(root, 'package/package.json'), raw);
    const result = spawnSync('tar', ['-czf', artifact, 'package/package.json'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  };
  const check = (tag: string) =>
    spawnSync(process.execPath, [script, artifact], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
      env: { ...env, GITHUB_REF_NAME: tag },
    });
  try {
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'core.hooksPath', path.join(root, 'empty-hooks'));
    mkdirSync(path.join(root, 'empty-hooks'));
    writeFileSync(path.join(root, 'package.json'), '{"name":"@pho9ubenaa/siro","version":"0.6.1"}');
    git('add', 'package.json');
    git('commit', '-m', 'chore: fixture');
    git('update-ref', 'refs/remotes/origin/main', git('rev-parse', 'HEAD'));
    mkdirSync(path.join(root, 'package'));
    const identity = { name: '@pho9ubenaa/siro', version: '0.6.1' };
    archive(JSON.stringify(identity));
    const valid = check('v0.6.1');
    expect(valid.error).toBeUndefined();
    expect(valid.status).toBe(0);
    expect(valid.stdout.trim()).toBe(
      createHash('sha256').update(readFileSync(artifact)).digest('hex'),
    );
    expect(check('v0.6.2').status).not.toBe(0);
    for (const raw of [
      JSON.stringify({ ...identity, name: 'other' }),
      JSON.stringify({ ...identity, version: '0.6.2' }),
      JSON.stringify({ ...identity, private: true }),
      'null',
      'FAKE_SECRET_NOT_JSON',
      `${JSON.stringify(identity)}\n${JSON.stringify(identity)}`,
    ]) {
      archive(raw);
      const invalid = check('v0.6.1');
      expect(invalid.error).toBeUndefined();
      expect(invalid.status).not.toBe(0);
      expect(invalid.stdout).toBe('');
      expect(invalid.stderr).not.toContain('FAKE_SECRET');
    }
    writeFileSync(artifact, 'not an archive');
    expect(check('v0.6.1').status).not.toBe(0);
    rmSync(artifact);
    expect(check('v0.6.1').status).not.toBe(0);
    archive(JSON.stringify(identity));
    git('switch', '-c', 'unreviewed');
    writeFileSync(path.join(root, 'extra'), 'data');
    git('add', 'extra');
    git('commit', '-m', 'chore: unreviewed');
    expect(check('v0.6.1').status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
