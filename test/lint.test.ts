import { captureIO } from './helpers/io.ts';
import path from 'node:path';
import { run } from '../src/cli.ts';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

describe('lint command — basic linting', () => {
  it('reports errors and exits 1 for a non-compliant npm repo', async () => {
    const { io, out } = captureIO();
    const code = await run(['lint', '--json', path.join(FIXTURES, 'npm-bad')], io);

    expect(code).toBe(EXIT_FAILURE);
    const parsed: {
      findings: { ruleId: string; severity: string }[];
      summary: { error: number };
    } = JSON.parse(out());
    expect(parsed.findings.map((finding) => finding.severity)).toContain('error');
    expect(parsed.summary).toStrictEqual({
      error: expect.any(Number),
      info: expect.any(Number),
      warn: expect.any(Number),
    });
    expect(parsed.summary.error).toBeGreaterThan(0);
  });

  it('lints representative npm, pnpm, Yarn, and Bun fixtures through their codecs', async () => {
    const results: { code: number; fixture: string; reportsScanner: boolean }[] = [];
    for (const fixture of ['npm-good', 'pnpm-good', 'yarn-good', 'bun-good']) {
      const { io, out } = captureIO();
      const code = await run(['lint', path.join(FIXTURES, fixture)], io);
      results.push({ code, fixture, reportsScanner: out().includes('bun-security-scanner') });
    }
    expect(results).toStrictEqual([
      { code: EXIT_SUCCESS, fixture: 'npm-good', reportsScanner: false },
      { code: EXIT_SUCCESS, fixture: 'pnpm-good', reportsScanner: false },
      { code: EXIT_SUCCESS, fixture: 'yarn-good', reportsScanner: false },
      { code: EXIT_SUCCESS, fixture: 'bun-good', reportsScanner: true },
    ]);
  });
});

describe('lint command — flags', () => {
  it('omits publish-only findings for an application project', async () => {
    const { io, out } = captureIO();
    await run(
      ['lint', '--project-type', 'application', '--json', path.join(FIXTURES, 'npm-bad')],
      io,
    );

    const parsed: { findings: { ruleId: string }[] } = JSON.parse(out());
    const publishOnly = new Set(['files-field', 'provenance', 'publish-access']);
    const ids = parsed.findings.map((finding) => finding.ruleId);
    expect(ids).toContain('disable-lifecycle-scripts');
    expect(ids.some((id) => publishOnly.has(id))).toBe(false);
  });

  it('fails on warnings when --severity warn is set', async () => {
    const { io, out } = captureIO();
    const code = await run(
      ['lint', '--severity', 'warn', '--json', path.join(FIXTURES, 'bun-good')],
      io,
    );

    expect(code).toBe(EXIT_FAILURE);
    const result = JSON.parse(out());
    expect(result.summary.error).toBe(0);
    expect(result.summary.warn).toBeGreaterThan(0);
  });

  it('rejects an invalid --severity value with exit 2', async () => {
    const { io } = captureIO();
    const code = await run(['lint', '--severity', 'nope', path.join(FIXTURES, 'npm-bad')], io);

    expect(code).toBe(EXIT_USAGE);
  });
});
