import { captureIO } from './helpers/io.ts';
import path from 'node:path';
import { run } from '../src/cli.ts';

vi.setConfig({ testTimeout: 5000 });

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;
const EMPTY = 0;

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
      expect(parsed.summary.error).toBeGreaterThan(EMPTY);
    });
  });

  it('exits 0 for an npm repo that follows the practice', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    return run(['lint', path.join(FIXTURES, 'npm-good')], io).then((code) => {
      expect(code).toBe(EXIT_SUCCESS);
      expect(out()).toMatch(/no .+(?<kind>issues|findings|problems)/iu);
    });
  });
});

describe('lint command — flags', () => {
  it('honours --pm to force a package manager', () => {
    expect.hasAssertions();
    const { io } = captureIO();
    return run(['lint', '--pm', 'npm', path.join(FIXTURES, 'npm-bad')], io).then((code) => {
      expect(code).toBe(EXIT_FAILURE);
    });
  });

  it('emits parseable JSON with --json', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    return run(['lint', '--json', path.join(FIXTURES, 'npm-bad')], io).then(() => {
      const parsed = JSON.parse(out());
      expect(parsed.findings).toStrictEqual(expect.any(Array));
      expect(parsed.summary).toStrictEqual({
        error: expect.any(Number),
        info: expect.any(Number),
        warn: expect.any(Number),
      });
    });
  });

  it('fails on warnings when --severity warn is set', () => {
    expect.hasAssertions();
    const { io } = captureIO();
    return run(['lint', '--severity', 'warn', path.join(FIXTURES, 'npm-bad')], io).then((code) => {
      expect(code).toBe(EXIT_FAILURE);
    });
  });

  it('rejects an invalid --severity value with exit 2', () => {
    expect.hasAssertions();
    const { io } = captureIO();
    return run(['lint', '--severity', 'nope', path.join(FIXTURES, 'npm-bad')], io).then((code) => {
      expect(code).toBe(EXIT_USAGE);
    });
  });
});
