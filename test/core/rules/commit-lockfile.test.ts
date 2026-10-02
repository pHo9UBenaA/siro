import { asAbsPath, lint, type LintOptions } from '../../../src/index.ts';
import { createMemFileSystem } from '../../helpers/memfs.ts';
import { bindingForTest } from '../../helpers/rules.ts';
import { manualSteps } from '../../helpers/remediation.ts';

import type { PM } from '../../../src/core/contracts/pms.ts';
import type { RuleContext } from '../../../src/core/contracts/repo-context.ts';
import { commitLockfile } from '../../../src/core/rules/commit-lockfile.ts';
import { makeCtx, makePublishableCtx } from '../../helpers/ctx.ts';

const ctxWith = (files: readonly string[]): RuleContext => makeCtx({ files });

describe('commit-lockfile (npm)', () => {
  const npmBinding = bindingForTest(commitLockfile, 'npm');

  it('requires an npm lockfile and explains how to generate it', () => {
    const status = npmBinding.check(ctxWith([]), {});

    expect(status.state).toBe('violation');

    expect(commitLockfile.severity).toBe('error');

    expect(manualSteps(status)[0]).toContain('generate package-lock.json');
  });

  it('passes when package-lock.json exists', () => {
    expect(npmBinding.check(ctxWith(['package-lock.json']), {}).state).toBe('ok');
  });

  it('requires a supported lockfile when only the removed npm shrinkwrap exists', () => {
    expect(npmBinding.check(ctxWith(['npm-shrinkwrap.json']), {}).state).toBe('violation');
  });
});

// PM-specific filenames and the text lockfiles Aube can reuse.
const LOCKFILE_BY_PM: readonly { pm: PM; lockfile: string }[] = [
  { lockfile: 'pnpm-lock.yaml', pm: 'pnpm' },
  { lockfile: 'yarn.lock', pm: 'yarn' },
  { lockfile: 'bun.lock', pm: 'bun' },
  { lockfile: 'deno.lock', pm: 'deno' },
  { lockfile: 'aube-lock.yaml', pm: 'aube' },
  { lockfile: 'pnpm-lock.yaml', pm: 'aube' },
  { lockfile: 'bun.lock', pm: 'aube' },
];

describe('commit-lockfile per-PM lockfile detection', () => {
  it.each(LOCKFILE_BY_PM)(
    '$pm: ok when $lockfile exists, violation when absent',
    ({ pm, lockfile }) => {
      const ruleBinding = bindingForTest(commitLockfile, pm);

      expect(
        ruleBinding.check(makePublishableCtx({ exists: (fp) => fp === lockfile }), {}).state,
      ).toBe('ok');
      expect(ruleBinding.check(makePublishableCtx({ exists: () => false }), {}).state).toBe(
        'violation',
      );
    },
  );
});

it.each([
  { lock: 'locks/custom.lock', files: ['locks/custom.lock'], state: 'ok' },
  { lock: { path: 'locks/custom.lock' }, files: ['locks/custom.lock'], state: 'ok' },
  { lock: 'locks/custom.lock', files: ['deno.lock'], state: 'violation' },
  { lock: false, files: ['deno.lock'], state: 'violation' },
  { lock: null, files: ['deno.lock'], state: 'ok' },
  { lock: { path: null, frozen: null }, files: ['deno.lock'], state: 'ok' },
  { lock: 42, files: ['deno.lock'], state: 'violation' },
  { lock: [], files: ['deno.lock'], state: 'violation' },
  { lock: { path: 42 }, files: ['deno.lock'], state: 'violation' },
  { lock: { frozen: 'yes' }, files: ['deno.lock'], state: 'violation' },
])('checks the Deno lockfile selected by configuration: %j', ({ lock, files, state }) => {
  const ctx = makeCtx({ files });
  expect(bindingForTest(commitLockfile, 'deno').check(ctx, { lock }).state).toBe(state);
});

it.each(['bun.lockb', 'deno.lock'])('does not treat %s as a reusable Aube lockfile', (file) => {
  expect(bindingForTest(commitLockfile, 'aube').check(makeCtx({ files: [file] }), {}).state).toBe(
    'violation',
  );
});

it('requires conversion of a binary Bun lockfile even when an Aube lockfile exists', () => {
  expect(
    bindingForTest(commitLockfile, 'aube').check(
      makeCtx({ files: ['aube-lock.yaml', 'bun.lockb'] }),
      {},
    ),
  ).toMatchObject({
    state: 'violation',
    remediation: { kind: 'manual', steps: [expect.stringContaining('--save-text-lockfile')] },
  });
});

describe('npm shrinkwrap target versions', () => {
  const inspect = (files: Record<string, string>, options: Partial<LintOptions> = {}) =>
    lint({
      cwd: asAbsPath('/repo'),
      fs: createMemFileSystem(files),
      installationRoots: [],
      ...options,
    });

  it.each([
    { version: '11.16.0', requiresMigration: false },
    { version: '12.0.0', requiresMigration: true },
    { version: undefined, requiresMigration: true },
  ])(
    'requires shrinkwrap migration=$requiresMigration for npm $version',
    ({ version, requiresMigration }) => {
      const result = inspect(
        { 'npm-shrinkwrap.json': '{}' },
        {
          installationRoots: ['.'],
          pm: 'npm',
          ...(version ? { pmVersion: version } : {}),
        },
      );
      const finding = result.findings.find((f) => f.ruleId === 'commit-lockfile');
      const migrationFinding = expect.objectContaining({
        message: expect.stringContaining('npm-shrinkwrap.json'),
      });
      expect(finding).toEqual(requiresMigration ? migrationFinding : undefined);
    },
  );
});
