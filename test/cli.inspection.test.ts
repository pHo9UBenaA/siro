import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createTempProject as fixture } from './helpers/temp-project.ts';
import path from 'node:path';

const bin = path.resolve(import.meta.dirname, '../dist/cli.js');
const run = (root: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, [bin, 'lint', root, '--json', ...args], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
};

it('Deno exclude-only age fails at configured severity even on a known newer target; fallback works', () => {
  const root = fixture({
    'deno.lock': '{}',
    'siro.config.mjs': "export default { rules: { 'minimum-release-age': 'error' } };",
  });
  try {
    writeFileSync(
      path.join(root, 'deno.json'),
      JSON.stringify({
        lock: { frozen: true },
        minimumDependencyAge: { exclude: ['npm:reviewed'] },
      }),
    );
    const result = run(root, '--pm', 'deno', '--pm-version', '2.9.4');
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).findings).toContainEqual(
      expect.objectContaining({ ruleId: 'minimum-release-age', severity: 'error' }),
    );
    writeFileSync(path.join(root, '.npmrc'), 'min-release-age=3');
    expect(run(root, '--pm', 'deno', '--pm-version', '2.8.1').status).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it.each([
  { npmrc: true, provenance: false, exit: 1, file: 'package.json' },
  { npmrc: false, provenance: true, exit: 0, file: undefined },
  { npmrc: true, provenance: undefined, exit: 0, file: undefined },
  { npmrc: false, provenance: undefined, exit: 1, file: '.npmrc' },
] as const)(
  'npm provenance precedence: npmrc=$npmrc manifest=$provenance exit=$exit',
  ({ npmrc, provenance, exit, file }) => {
    const root = fixture({
      'package-lock.json': '{}',
      'package.json': JSON.stringify({ name: 'pkg', publishConfig: { provenance } }),
      '.npmrc': `provenance=${npmrc}\nignore-scripts=true\nsave-exact=true\nmin-release-age=3\nallow-git=none\nallow-remote=none`,
    });
    try {
      const result = run(root, '--pm', 'npm', '--pm-version', '12.0.2', '--severity', 'warn');
      expect(result.status).toBe(exit);
      const finding = JSON.parse(result.stdout).findings.find(
        (candidate: { ruleId: string }) => candidate.ruleId === 'provenance',
      );
      expect(finding?.file).toBe(file);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

it('repeatable flags replace config arrays; schema 3 preserves scope through display filtering', () => {
  const root = fixture({
    'package.json': '{"private":true}',
    'tool/package.json': '{"private":true,"packageManager":"npm@12.0.2"}',
    'bad/package.json': '{',
    'other/package.json': '{',
    'siro.config.mjs': "export default { installationRoots: [], exclude: ['tool'] };",
  });
  try {
    const result = run(
      root,
      '--exclude',
      'bad',
      '--exclude=other',
      '--installation-root',
      'tool',
      '--severity',
      'error',
    );
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.schemaVersion).toBe(3);
    expect(report.inspection.installationRoots).toEqual([
      { directory: 'tool', targets: [{ pm: 'npm', version: '12.0.2' }] },
    ]);
    expect(report.inspection.manifests.map((manifest: { path: string }) => manifest.path)).toEqual([
      'package.json',
      'tool/package.json',
    ]);
    for (const args of [
      ['--workspaces'],
      ['--exclude='],
      ['--installation-root'],
      ['--installation-root='],
    ]) {
      const invalid = run(root, ...args);
      expect(invalid.status).toBe(2);
      expect(invalid.stdout).toBe('');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
