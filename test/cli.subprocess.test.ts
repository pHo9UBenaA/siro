const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;
const EXIT_CRASH = 70;
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { object, parse, string } from 'valibot';

const parseJsonOutput = (
  stdout: string,
  stderr: string,
): { findings: { ruleId: string; severity: string }[] } => {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(
      `JSON reporter did not produce valid JSON.\nstdout: ${stdout}\nstderr: ${stderr}`,
    );
  }
};

const REPO_ROOT = path.join(import.meta.dirname, '..');
const packageManifest = parse(
  object({ bin: object({ siro: string() }) }),
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')),
);
const DIST_BIN = path.resolve(REPO_ROOT, packageManifest.bin.siro);
const FIXTURES = path.join(import.meta.dirname, 'fixtures');

const spawnBin = (args: readonly string[]) => {
  if (process.platform === 'win32') {
    return spawnSync(process.execPath, [DIST_BIN, ...args], { encoding: 'utf8' });
  }
  return spawnSync(DIST_BIN, args, { encoding: 'utf8' });
};

it.each(['application', 'package'])(
  'lints npm private publish access under %s policy through the executable',
  (projectType) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'siro-npm-access-'));
    try {
      writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: '@scope/example',
          packageManager: 'npm@12.0.2',
          publishConfig: { access: 'private' },
        }),
      );
      writeFileSync(path.join(dir, '.npmrc'), 'ignore-scripts=true\nsave-exact=true\n');
      writeFileSync(path.join(dir, 'package-lock.json'), '{}');
      const result = spawnBin(['lint', dir, '--json', '--project-type', projectType]);
      expect(result.status).toBe(EXIT_SUCCESS);
      const parsed = parseJsonOutput(result.stdout, result.stderr);
      expect(parsed.findings.some((finding) => finding.ruleId === 'publish-access')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

describe('CLI binary — lint behaviour', () => {
  test('lints a known-bad fixture and exits 1 with structured JSON output', () => {
    expect.hasAssertions();
    const result = spawnBin(['lint', '--reporter', 'json', path.join(FIXTURES, 'npm-bad')]);
    expect(result.status, `stderr: ${result.stderr}`).toBe(EXIT_FAILURE);
    const parsed = parseJsonOutput(result.stdout, result.stderr);
    const ids = parsed.findings.map((finding) => finding.ruleId);
    expect(ids).toContain('disable-lifecycle-scripts');
  });
});

it('reports a null npm save prefix through the executable', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-npm-prefix-'));
  try {
    writeFileSync(path.join(dir, '.npmrc'), 'save-prefix=null');
    const result = spawnBin(['lint', dir, '--pm', 'npm', '--json']);
    expect(result.status).toBe(EXIT_FAILURE);
    const parsed = parseJsonOutput(result.stdout, result.stderr);
    expect(parsed.findings).toContainEqual(
      expect.objectContaining({ ruleId: 'pin-exact-versions', severity: 'error' }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it.each([
  { npmrc: 'min-release-age=3\nbefore=2999-01-01', status: EXIT_FAILURE },
  { npmrc: 'before=2020-01-01', status: EXIT_SUCCESS },
])('checks the npm cutoff through the executable: $npmrc', ({ npmrc, status }) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-npm-age-'));
  try {
    writeFileSync(path.join(dir, '.npmrc'), `ignore-scripts=true\nsave-exact=true\n${npmrc}\n`);
    writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    const result = spawnBin(['lint', dir, '--pm', 'npm', '--json', '--severity', 'warn']);
    expect(result.status).toBe(status);
    const parsed = parseJsonOutput(result.stdout, result.stderr);
    expect(parsed.findings.some((finding) => finding.ruleId === 'minimum-release-age')).toBe(
      status === EXIT_FAILURE,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe.skipIf(process.platform === 'win32')('CLI binary — installed symlink', () => {
  test('prints the version when invoked through an installation-style bin symlink', () => {
    expect.hasAssertions();
    const dir = mkdtempSync(path.join(tmpdir(), 'siro-bin-'));
    try {
      const installedBin = path.join(dir, 'siro');
      symlinkSync(DIST_BIN, installedBin);
      const result = spawnSync(installedBin, ['--version'], { encoding: 'utf8' });
      expect(result.status, `stderr: ${result.stderr}`).toBe(EXIT_SUCCESS);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/u);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});

describe('CLI binary — version and flags', () => {
  test('prints the version on --version and exits 0', () => {
    expect.hasAssertions();
    const result = spawnBin(['--version']);
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/u);
  });

  test('returns exit 2 with a UsageError on an unknown flag', () => {
    expect.hasAssertions();
    const result = spawnBin(['lint', '--no-such-flag']);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toMatch(/Unknown flag/u);
  });
});

describe('CLI binary — error handling', () => {
  test('exits 2 and names a JSON config whose root is not a mapping', () => {
    expect.hasAssertions();
    const dir = mkdtempSync(path.join(tmpdir(), 'siro-invalid-config-root-'));
    try {
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo' }));
      writeFileSync(path.join(dir, 'deno.json'), '[]');
      const result = spawnBin(['lint', dir]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(EXIT_USAGE);
      expect(result.stderr).toMatch(/deno\.json: config root must be a mapping/iu);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  test('exits 2 when a config contains a malformed custom rule', () => {
    expect.hasAssertions();
    const dir = mkdtempSync(path.join(tmpdir(), 'siro-invalid-rule-'));
    try {
      writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'demo', packageManager: 'pnpm@10.0.0' }),
      );
      writeFileSync(path.join(dir, 'siro.config.mjs'), 'export default { customRules: [null] };\n');
      const result = spawnBin(['lint', dir]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(EXIT_USAGE);
      expect(result.stderr).toMatch(/customRules\.0/iu);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  test('exits 70 when a config reporter throws (uncaught user-extension error)', () => {
    expect.hasAssertions();
    const dir = mkdtempSync(path.join(tmpdir(), 'siro-boom-'));
    try {
      writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'demo', packageManager: 'pnpm@10.0.0' }),
      );
      writeFileSync(
        path.join(dir, 'siro.config.ts'),
        "export default { reporters: [{ name: 'boom', format() { throw new Error('boom from reporter'); } }] };\n",
      );
      const result = spawnBin(['lint', '--reporter', 'boom', dir]);
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(EXIT_CRASH);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
