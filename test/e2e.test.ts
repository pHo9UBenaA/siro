import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert';
import { captureIO } from './helpers/io.ts';
import { parseGithubAnnotation } from './helpers/github-annotation.ts';
import path from 'node:path';
import { run } from '../src/cli.ts';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const FIRST_INDEX = 0;
const EXIT_CODE_CONFIG_ERROR = 2;

const assertGithubAnnotationShape = (
  annotations: ReturnType<typeof parseGithubAnnotation>[],
): void => {
  expect(annotations).toStrictEqual(
    expect.arrayContaining([
      expect.objectContaining({
        body: expect.stringMatching(/^\[npm\] /u),
        command: 'error',
        props: expect.objectContaining({ title: 'disable-lifecycle-scripts' }),
      }),
    ]),
  );
};

const expectConfigError = (code: number, errOutput: string, pattern: RegExp): void => {
  expect(code).toBe(EXIT_CODE_CONFIG_ERROR);
  expect(errOutput).toMatch(pattern);
};

const lintAndExpectConfigError = (dir: string, pattern: RegExp): Promise<void> => {
  const { io, err } = captureIO();
  return run(['lint', dir], io).then((code) => {
    expectConfigError(code, err(), pattern);
  });
};

const setupTempDir = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-e2e-'));
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'demo', packageManager: 'npm@10.9.0' }),
  );
  return dir;
};

describe('e2E --reporter github', () => {
  it('emits workflow annotations whose parsed shape names the rule, PM and severity command', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    return run(['lint', '--reporter', 'github', path.join(FIXTURES, 'npm-bad')], io).then(() => {
      const annotations = out()
        .split('\n')
        .filter((line) => line.startsWith('::'))
        .map((line) => parseGithubAnnotation(line));
      expect(annotations.length).toBeGreaterThan(FIRST_INDEX);
      assertGithubAnnotationShape(annotations);
    });
  });
});

describe('e2E siro.config.ts rule overrides', () => {
  let dir = '';
  let parsed: { findings: { ruleId: string; severity: string }[] } = { findings: [] };
  beforeEach(() => {
    dir = setupTempDir();
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      "export default { rules: { 'pin-exact-versions': 'warn', provenance: 'off' } };\n",
    );
    const { io, out } = captureIO();
    return run(['lint', '--reporter', 'json', dir], io).then(() => {
      parsed = JSON.parse(out());
    });
  });
  afterEach(() => rmSync(dir, { force: true, recursive: true }));

  it("demotes a rule's reported severity to warn when the user config sets the rule to 'warn'", () => {
    expect.hasAssertions();
    const finding = parsed.findings.find((entry) => entry.ruleId === 'pin-exact-versions');
    assert(finding, 'expected a pin-exact-versions finding');
    expect(finding.severity).toBe('warn');
  });

  it("omits a rule entirely from the findings when the user config sets the rule to 'off'", () => {
    expect.hasAssertions();
    const ids = new Set(parsed.findings.map((entry) => entry.ruleId));
    expect(ids.has('provenance')).toBe(false);
  });
});

describe('e2E siro.config.ts error exits', () => {
  let dir = '';
  beforeEach(() => {
    dir = setupTempDir();
  });
  afterEach(() => rmSync(dir, { force: true, recursive: true }));

  it("exits 2 when siro.config pms restricts to a PM that's not present", () => {
    expect.hasAssertions();
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo' }));
    writeFileSync(path.join(dir, 'siro.config.mjs'), "export default { pms: ['pnpm'] };\n");
    return lintAndExpectConfigError(dir, /no package manager detected.*restricts pms/iu);
  });

  it('exits 2 when package.json is corrupt', () => {
    expect.hasAssertions();
    writeFileSync(path.join(dir, 'package.json'), '{ not valid json');
    return lintAndExpectConfigError(dir, /package\.json: invalid json/iu);
  });

  it('exits 2 when a target codec file is malformed (no raw stack trace)', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'demo', packageManager: 'bun@1.3.0' }),
    );
    writeFileSync(path.join(dir, 'bunfig.toml'), '[install]\nexact = "unterminated');
    return lintAndExpectConfigError(dir, /bunfig\.toml/u);
  });

  it("exits 2 when detected PMs don't match the siro.config pms restriction", () => {
    expect.hasAssertions();
    writeFileSync(path.join(dir, 'siro.config.mjs'), "export default { pms: ['pnpm'] };\n");
    return lintAndExpectConfigError(dir, /do not match siro\.config\.ts pms/u);
  });

  it('lint exits 2 when no PM is detected (no silent npm fallback)', () => {
    expect.hasAssertions();
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo' }));
    return lintAndExpectConfigError(dir, /no package manager detected.*pass --pm/iu);
  });

  it('exits 2 when an unknown rule id appears in overrides', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      "export default { rules: { 'no-such-rule': 'warn' } };\n",
    );
    return lintAndExpectConfigError(dir, /no-such-rule/u);
  });
});
