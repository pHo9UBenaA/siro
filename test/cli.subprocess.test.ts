import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { object, parse, string } from 'valibot';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;
const EXIT_CRASH = 70;

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

const spawnBin = (args: readonly string[]) => {
  const options = { encoding: 'utf8' as const, timeout: 30_000 };
  const result =
    process.platform === 'win32'
      ? spawnSync(process.execPath, [DIST_BIN, ...args], options)
      : spawnSync(DIST_BIN, args, options);
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
};

it('reports selected JSONC-only manifests with exit 2, regardless of Deno workspace declarations', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-deno-member-'));
  try {
    mkdirSync(path.join(dir, 'child'));
    writeFileSync(path.join(dir, 'deno.json'), '{"workspace":["child"]}');
    writeFileSync(path.join(dir, 'child/deno.jsonc'), '{}');
    const result = spawnBin(['lint', dir, '--pm', 'deno', '--json']);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('child/deno.jsonc');
    expect(result.stdout).toBe('');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('reports an un-compilable exclusion pattern with exit 2', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-workspace-pattern-'));
  try {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ workspaces: ['a'.repeat(65_537)] }),
    );
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      `export default { exclude: [${JSON.stringify('a'.repeat(65_537))}] };`,
    );
    const result = spawnBin([
      'lint',
      dir,
      '--config',
      path.join(dir, 'siro.config.mjs'),
      '--pm',
      'npm',
      '--json',
    ]);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('exclude');
    expect(result.stdout).toBe('');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe.skipIf(process.platform === 'win32')('FIFO manifests', () => {
  it.each(['package.json', 'child/package.json'])(
    'rejects a FIFO manifest at %s without blocking',
    (manifest) => {
      const dir = mkdtempSync(path.join(tmpdir(), 'siro-fifo-manifest-'));
      try {
        if (manifest.startsWith('child/')) {
          mkdirSync(path.join(dir, 'child'));
          writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify({ private: true, workspaces: ['child'] }),
          );
        }
        expect(spawnSync('mkfifo', [path.join(dir, manifest)]).status).toBe(0);
        const result = spawnSync(
          process.execPath,
          [DIST_BIN, 'lint', dir, '--pm', 'npm', '--json'],
          { encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL' },
        );
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(EXIT_USAGE);
        expect(result.stderr).toContain(manifest);
        expect(result.stderr).toContain('expected a regular file');
        expect(result.stdout).toBe('');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

it('reports recursively discovered package paths and failures without executing child config', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-workspace-cli-'));
  try {
    mkdirSync(path.join(dir, 'child'));
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ private: true, packageManager: 'npm@11.10.0', workspaces: ['child'] }),
    );
    writeFileSync(path.join(dir, '.npmrc'), 'ignore-scripts=true\nsave-exact=true');
    writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      "export default { rules: { 'files-field': 'error' } };\n",
    );
    writeFileSync(path.join(dir, 'child/package.json'), '{"name":"child"}');
    writeFileSync(path.join(dir, 'child/siro.config.mjs'), 'throw new Error("must not execute")');
    const args = ['lint', dir, '--config', path.join(dir, 'siro.config.mjs')];
    expect(spawnBin([...args, '--exclude', 'child']).status).toBe(EXIT_SUCCESS);
    const result = spawnBin([...args, '--json']);
    expect(result.status).toBe(EXIT_FAILURE);
    expect(parseJsonOutput(result.stdout, result.stderr).findings).toContainEqual(
      expect.objectContaining({
        ruleId: 'files-field',
        file: 'child/package.json',
        severity: 'error',
      }),
    );
    const annotations = spawnBin([...args, '--reporter', 'github']);
    expect(annotations.stdout).toContain(
      `file=${path.join(dir, 'child/package.json').replaceAll(':', '%3A')}`,
    );
    writeFileSync(path.join(dir, 'child/package.json'), '{');
    const broken = spawnBin([...args, '--json']);
    expect(broken.status).toBe(EXIT_USAGE);
    expect(broken.stderr).toContain('child/package.json');
    expect(broken.stdout).toBe('');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 15_000);

it('rejects a directory masquerading as a lockfile instead of reporting a successful check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-lock-directory-'));
  try {
    writeFileSync(
      path.join(dir, 'package.json'),
      '{"private":true,"packageManager":"npm@11.10.0"}',
    );
    writeFileSync(path.join(dir, '.npmrc'), 'ignore-scripts=true\nsave-exact=true\n');
    mkdirSync(path.join(dir, 'package-lock.json'));
    const result = spawnBin(['lint', dir, '--json']);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('package-lock.json');
    expect(result.stdout).toBe('');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('checks declared, configured, and CLI PM targets through the executable', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-pm-version-'));
  try {
    writeFileSync(path.join(dir, 'package.json'), '{"private":true,"packageManager":"npm@11.9.0"}');
    writeFileSync(
      path.join(dir, '.npmrc'),
      'min-release-age=3\nignore-scripts=true\nsave-exact=true',
    );
    writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    const args = ['lint', dir, '--json'];
    const old = spawnBin(args);
    expect(old.status).toBe(EXIT_FAILURE);
    expect(parseJsonOutput(old.stdout, old.stderr).findings).toContainEqual(
      expect.objectContaining({ ruleId: 'unsupported-settings' }),
    );
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      "export default { pmVersions: { npm: '11.10.0' } };\n",
    );
    const configuredArgs = [...args, '--config', path.join(dir, 'siro.config.mjs')];
    expect(spawnBin(configuredArgs).status).toBe(EXIT_SUCCESS);
    expect(spawnBin([...configuredArgs, '--pm', 'npm', '--pm-version=11.9.0']).status).toBe(
      EXIT_FAILURE,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CLI binary — error handling', () => {
  test.each(['', 'async '])(
    'exits 70 after partial output when a %sconfig reporter throws',
    (modifier) => {
      const dir = mkdtempSync(path.join(tmpdir(), 'siro-boom-'));
      try {
        writeFileSync(
          path.join(dir, 'package.json'),
          JSON.stringify({ name: 'demo', packageManager: 'pnpm@10.0.0' }),
        );
        writeFileSync(
          path.join(dir, 'siro.config.ts'),
          `export default {
            reporters: [{
              name: 'boom',
              ${modifier}format(_result, io) {
                io.stdout('partial output');
                throw new Error('boom from reporter');
              },
            }],
          };`,
        );
        const result = spawnBin([
          'lint',
          '--config',
          path.join(dir, 'siro.config.ts'),
          '--reporter',
          'boom',
          dir,
        ]);
        expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(
          EXIT_CRASH,
        );
        expect(result.stdout).toContain('partial output');
        expect(result.stderr).toContain('boom from reporter');
      } finally {
        rmSync(dir, { force: true, recursive: true });
      }
    },
  );
});
