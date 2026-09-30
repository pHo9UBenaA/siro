import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { createHash } from 'node:crypto';

it('does not expose OIDC to install/build/verification and transfers one exact artifact', () => {
  const workflow = parse(
    readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/publish.yaml'), 'utf8'),
  );
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

it('never stages missing, substituted or misidentified artifact bytes', (context) => {
  if (process.platform !== 'linux') {
    context.skip();
    return;
  }
  const root = mkdtempSync(path.join(tmpdir(), 'siro-stage-boundary-'));
  const workflow = parse(
    readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/publish.yaml'), 'utf8'),
  );
  const script = workflow.jobs.publish.steps.find((step: { run?: string }) =>
    step.run?.includes('npm stage publish'),
  ).run;
  try {
    mkdirSync(path.join(root, 'package'));
    const archive = (version = '0.6.1') => {
      writeFileSync(
        path.join(root, 'package/package.json'),
        JSON.stringify({ name: '@pho9ubenaa/siro', version }),
      );
      const packed = spawnSync(
        'tar',
        ['-czf', path.join(root, 'release/siro.tgz'), 'package/package.json'],
        { cwd: root, encoding: 'utf8', timeout: 10000 },
      );
      expect(packed.status).toBe(0);
      return createHash('sha256')
        .update(readFileSync(path.join(root, 'release/siro.tgz')))
        .digest('hex');
    };
    mkdirSync(path.join(root, 'bin'));
    mkdirSync(path.join(root, 'release'));
    writeFileSync(
      path.join(root, 'bin/npm'),
      '#!/bin/sh\nprintf staged > "$RUNNER_TEMP/staged"\n',
      { mode: 0o755 },
    );
    const execute = (sha: string, tag = 'v0.6.1') =>
      spawnSync('bash', ['-c', script], {
        encoding: 'utf8',
        timeout: 10000,
        env: {
          PATH: `${path.join(root, 'bin')}:${process.env.PATH}`,
          RUNNER_TEMP: root,
          ARTIFACT_SHA256: sha,
          RELEASE_VERSION: '0.6.1',
          GITHUB_REF_NAME: tag,
        },
      });
    const digest = archive();
    expect(execute('0'.repeat(64)).status).not.toBe(0);
    expect(execute(digest, 'v0.6.2').status).not.toBe(0);
    expect(execute(archive('0.6.2')).status).not.toBe(0);
    rmSync(path.join(root, 'release/siro.tgz'));
    expect(execute(digest).status).not.toBe(0);
    expect(() => readFileSync(path.join(root, 'staged'))).toThrow(/ENOENT/);
    expect(execute(archive()).status).toBe(0);
    expect(readFileSync(path.join(root, 'staged'), 'utf8')).toBe('staged');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('rejects a release tag/version mismatch and a commit outside main', () => {
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
  const check = (tag: string) =>
    spawnSync(process.execPath, [script], {
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
    expect(check('v0.6.1').status).toBe(0);
    expect(check('v0.6.2').status).not.toBe(0);
    git('switch', '-c', 'unreviewed');
    writeFileSync(path.join(root, 'extra'), 'data');
    git('add', 'extra');
    git('commit', '-m', 'chore: unreviewed');
    expect(check('v0.6.1').status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
