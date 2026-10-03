import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { createHash } from 'node:crypto';
import * as vb from 'valibot';

const StepSchema = vb.looseObject({
  run: vb.optional(vb.string()),
  uses: vb.optional(vb.string()),
  with: vb.optional(vb.record(vb.string(), vb.unknown())),
});
const JobSchema = vb.looseObject({
  steps: vb.array(StepSchema),
  permissions: vb.record(vb.string(), vb.string()),
  needs: vb.optional(vb.string()),
});
const WorkflowSchema = vb.looseObject({
  permissions: vb.record(vb.string(), vb.string()),
  jobs: vb.record(vb.string(), JobSchema),
});
const workflow = vb.parse(
  WorkflowSchema,
  parse(
    readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/publish.yaml'), 'utf8'),
  ),
);
const { build, publish } = workflow.jobs;
if (!build || !publish) throw new Error('Publish workflow requires build and publish jobs.');

it('does not expose OIDC to install/build/verification and transfers one exact artifact', () => {
  const buildSteps = build.steps;
  const pack = buildSteps.findIndex((step) => step.run?.includes('pnpm test:package'));
  const identity = buildSteps.findIndex((step) => step.run?.includes('scripts/check-release.mjs'));
  const upload = buildSteps.findIndex((step) => step.uses?.startsWith('actions/upload-artifact'));
  expect(pack).toBeGreaterThanOrEqual(0);
  expect(identity).toBeGreaterThan(pack);
  expect(upload).toBeGreaterThan(identity);
  expect(workflow.permissions['id-token']).toBeUndefined();
  expect(build.permissions['id-token']).toBeUndefined();
  expect(publish.needs).toBe('build');
  expect(publish.permissions['id-token']).toBe('write');
  const steps = publish.steps;
  expect(steps.some((step) => step.uses?.startsWith('actions/checkout'))).toBe(false);
  const publishCommands = steps.map((step) => step.run ?? '').join('\n');
  expect(publishCommands).not.toMatch(/pnpm|scripts\/|npm install|npm run|npm pack/);
  expect(publishCommands).toContain('sha256sum --check --strict');
  expect(publishCommands).toContain('npm stage publish');
  expect(
    steps.find((step) => step.uses?.startsWith('actions/download-artifact'))?.with?.[
      'artifact-ids'
    ],
  ).toContain('needs.build.outputs.artifactId');
  const actions: string[] = [];
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps) {
      if (step.uses !== undefined) actions.push(step.uses);
    }
  }
  for (const action of actions) expect(action).toMatch(/@[a-f0-9]{40}$/);
});

it('only stages the bytes matching the build checksum', (context) => {
  if (process.platform !== 'linux') {
    context.skip();
    return;
  }
  const root = mkdtempSync(path.join(tmpdir(), 'siro-stage-boundary-'));
  const script = publish.steps.find((step) => step.run?.includes('npm stage publish'))?.run;
  if (!script) throw new Error('Publish workflow requires an npm staging command.');
  try {
    mkdirSync(path.join(root, 'bin'));
    mkdirSync(path.join(root, 'release'));
    writeFileSync(
      path.join(root, 'bin/npm'),
      '#!/bin/sh\ntest "$1" = stage && test "$2" = publish && cp "$3" "$RUNNER_TEMP/staged"\n',
      { mode: 0o755 },
    );
    const execute = (sha: string) => {
      const result = spawnSync('bash', ['-c', script], {
        encoding: 'utf8',
        timeout: 10000,
        env: {
          PATH: `${path.join(root, 'bin')}:${process.env.PATH}`,
          RUNNER_TEMP: root,
          ARTIFACT_SHA256: sha,
          LC_ALL: 'C',
        },
      });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      return result;
    };
    const artifact = path.join(root, 'release/siro.tgz');
    const bytes = 'verified artifact';
    const digest = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(artifact, bytes);
    const invalidDigest = execute('not-a-digest');
    expect(invalidDigest.status).toBe(1);
    expect(invalidDigest.stdout).toBe('');
    writeFileSync(artifact, 'substituted artifact');
    const substituted = execute(digest);
    expect(substituted.status).toBe(1);
    expect(substituted.stdout).toContain('FAILED');
    rmSync(artifact);
    const missing = execute(digest);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('No such file');
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
  const check = (tag: string) => {
    const result = spawnSync(process.execPath, [script, artifact], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
      env: { ...env, GITHUB_REF_NAME: tag },
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  const rejectRelease = (tag: string, diagnostic: string) => {
    const result = check(tag);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(diagnostic);
    expect(result.stderr).not.toContain('FAKE_SECRET');
  };
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
    const identityError = 'Packed package identity does not match the public release tag.';
    const metadataError = 'Invalid release package metadata.';
    rejectRelease('v0.6.2', identityError);
    for (const [raw, diagnostic] of [
      [JSON.stringify({ ...identity, name: 'other' }), identityError],
      [JSON.stringify({ ...identity, version: '0.6.2' }), identityError],
      [JSON.stringify({ ...identity, private: true }), identityError],
      ['null', identityError],
      ['FAKE_SECRET_NOT_JSON', metadataError],
      [`${JSON.stringify(identity)}\n${JSON.stringify(identity)}`, metadataError],
    ] as const) {
      archive(raw);
      rejectRelease('v0.6.1', diagnostic);
    }
    writeFileSync(artifact, 'not an archive');
    rejectRelease('v0.6.1', 'Cannot read packed package metadata.');
    rmSync(artifact);
    rejectRelease('v0.6.1', 'ENOENT');
    archive(JSON.stringify(identity));
    git('switch', '-c', 'unreviewed');
    writeFileSync(path.join(root, 'extra'), 'data');
    git('add', 'extra');
    git('commit', '-m', 'chore: unreviewed');
    rejectRelease('v0.6.1', 'Release commit must belong to fetched origin/main.');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
