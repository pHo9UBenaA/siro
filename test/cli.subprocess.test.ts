const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;
const EXIT_CRASH = 70;
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

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

const DIST_BIN = path.join(import.meta.dirname, '..', 'dist', 'cli.mjs');
const FIXTURES = path.join(import.meta.dirname, 'fixtures');

// The rest of the suite drives `run()` from src/cli.ts in-process — fast,
// but it never exercises the published bin: the shebang, `process.argv`
// shape, exit code routing via `process.exitCode`, or anything tsdown's
// bundler folds into dist/cli.mjs (jiti resolution, esm interop, etc.).
// A real `spawnSync` against the built binary is the only check that
// proves the npm-installable artefact still works.
//
// We can't always require the bin: a clean checkout has no dist/, so the
// block opts out when the artefact is absent. CI=true makes that opt-out a
// loud failure — a pipeline that runs `pnpm test` without `pnpm build` would
// otherwise pass with the artefact smoke-test silently uncounted. Local
// `pnpm test` after a fresh checkout still skips, with a visible it.skip
// placeholder so the gap is at least visible in vitest's output instead of
// looking like the file wasn't loaded at all.
const DIST_PRESENT = existsSync(DIST_BIN);
if (!DIST_PRESENT && process.env.CI === 'true') {
  throw new Error(
    `CI=true but ${DIST_BIN} not found. Run \`pnpm build\` before \`pnpm test\` so the binary smoke tests can run.`,
  );
}

describe.skipIf(!DIST_PRESENT)('CLI binary — lint behaviour', () => {
  test('lints a known-bad fixture and exits 1 with structured JSON output', () => {
    expect.hasAssertions();
    const result = spawnSync(
      process.execPath,
      [DIST_BIN, 'lint', '--reporter', 'json', path.join(FIXTURES, 'npm-bad')],
      { encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}`).toBe(EXIT_FAILURE);
    const parsed = parseJsonOutput(result.stdout, result.stderr);
    const ids = parsed.findings.map((finding) => finding.ruleId);
    expect(ids).toContain('disable-lifecycle-scripts');
  });
});

describe.skipIf(!DIST_PRESENT)('CLI binary — version and flags', () => {
  test('prints the version on --version and exits 0', () => {
    expect.hasAssertions();
    const result = spawnSync(process.execPath, [DIST_BIN, '--version'], { encoding: 'utf8' });
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/u);
  });

  test('returns exit 2 with a UsageError on an unknown flag', () => {
    expect.hasAssertions();
    const result = spawnSync(process.execPath, [DIST_BIN, 'lint', '--no-such-flag'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toMatch(/Unknown flag/u);
  });
});

describe.skipIf(!DIST_PRESENT)('CLI binary — error handling', () => {
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
      const result = spawnSync(process.execPath, [DIST_BIN, 'lint', '--reporter', 'boom', dir], {
        encoding: 'utf8',
      });
      expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(EXIT_CRASH);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
