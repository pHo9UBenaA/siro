import { captureIO } from './helpers/io.ts';
import path from 'node:path';
import { run } from '../src/cli.ts';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

describe('lint command — basic linting', () => {
  it('reports errors and exits 1 for a non-compliant npm repo', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    return run(['lint', '--json', path.join(FIXTURES, 'npm-bad')], io).then((code) => {
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
  });

  it('lints representative npm, pnpm, Yarn, and Bun fixtures through their codecs', async () => {
    expect.hasAssertions();
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
  it('omits publish-only findings for an application project', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    return run(
      ['lint', '--project-type', 'application', '--json', path.join(FIXTURES, 'npm-bad')],
      io,
    ).then(() => {
      const parsed: { findings: { ruleId: string }[] } = JSON.parse(out());
      const publishOnly = new Set(['files-field', 'provenance', 'publish-access']);
      const ids = parsed.findings.map((finding) => finding.ruleId);
      expect({
        keepsSharedRules: ids.includes('disable-lifecycle-scripts'),
        publishOnly: ids.filter((id) => publishOnly.has(id)),
      }).toStrictEqual({ keepsSharedRules: true, publishOnly: [] });
    });
  });

  it('fails on warnings when --severity warn is set', () => {
    const { io, out } = captureIO();
    return run(['lint', '--severity', 'warn', '--json', path.join(FIXTURES, 'bun-good')], io).then(
      (code) => {
        expect(code).toBe(EXIT_FAILURE);
        const result = JSON.parse(out());
        expect(result.summary.error).toBe(0);
        expect(result.summary.warn).toBeGreaterThan(0);
      },
    );
  });

  it('rejects an invalid --severity value with exit 2', () => {
    expect.hasAssertions();
    const { io } = captureIO();
    return run(['lint', '--severity', 'nope', path.join(FIXTURES, 'npm-bad')], io).then((code) => {
      expect(code).toBe(EXIT_USAGE);
    });
  });
});
