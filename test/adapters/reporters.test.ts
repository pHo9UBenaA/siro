import {
  BUILTIN_REPORTER_NAMES,
  createRegistry,
  githubReporter,
  jsonReporter,
  prettyReporter,
} from '../../src/adapters/reporters/registry.ts';
import type { LintResult } from '../../src/domain/entities/lint-result.ts';
import assert from 'node:assert';
import { captureIO } from '../helpers/io.ts';
import { parseGithubAnnotation } from '../helpers/github-annotation.ts';

vi.setConfig({ testTimeout: 5000 });

const ESC_OPEN = '[';
const FINDING_COUNT = 3;
const SINGLE_FINDING = 1;
const FIRST_LINE = 0;
const EMPTY = 0;

const firstLineOf = (text: string): string => {
  const line = text.split('\n')[FIRST_LINE];
  assert(line, 'expected at least one line');
  return line;
};

const result: LintResult = {
  findings: [
    {
      file: '.npmrc',
      fix: [],
      fixable: true,
      message: 'set ignore-scripts',
      pm: 'npm',
      ruleId: 'disable-lifecycle-scripts',
      severity: 'error',
    },
  ],
  summary: { error: 1, info: 0, warn: 0 },
};

describe('reporters registry', () => {
  it('ships pretty / json / github as builtins', () => {
    expect.hasAssertions();
    expect(BUILTIN_REPORTER_NAMES).toStrictEqual(['pretty', 'json', 'github']);
    const registry = createRegistry();
    expect(registry.get('pretty')).toBe(prettyReporter);
    expect(registry.get('json')).toBe(jsonReporter);
    expect(registry.get('github')).toBe(githubReporter);
  });

  it('returns undefined for unknown reporters', () => {
    expect.hasAssertions();
    expect(createRegistry().get('xml')).toBeUndefined();
  });

  it('createRegistry rejects a malformed extra reporter (public-API shape guard)', () => {
    expect.hasAssertions();
    // createRegistry is exported; an embedder calling it directly with a value
    // missing `format` must get a clear error here, not a TypeError when the
    // bad object is later asked to render.
    expect(() => createRegistry(JSON.parse('[{"name":"broken"}]'))).toThrow(
      /name.*format|format/iu,
    );
  });

  it('createRegistry merges builtins with extras (later wins on collision)', () => {
    expect.hasAssertions();
    // Two extras: one with a fresh name (`noop`) to assert extras land in
    // the registry alongside builtins, and one with a colliding name
    // (`pretty`) to pin the documented "later wins" override semantic. A
    // regression that reversed the Map insertion order (builtins after
    // extras, builtins winning) would leave the previous test green
    // because the no-collision extra also survives under either order.
    const noop = {
      format: (): void => {
        /* no-op */
      },
      name: 'noop',
    };
    const overridePretty = {
      format: (): void => {
        /* no-op */
      },
      name: 'pretty',
    };
    const registry = createRegistry([noop, overridePretty]);
    expect(registry.get('noop')).toBe(noop);
    expect(registry.get('pretty')).toBe(overridePretty);
    expect(registry.get('pretty')).not.toBe(prettyReporter);
    expect(registry.list()).toStrictEqual(
      expect.arrayContaining(['pretty', 'json', 'github', 'noop']),
    );
  });
});

describe('json reporter', () => {
  it('produces a single JSON document that downstream tools can parse', () => {
    expect.hasAssertions();
    const tri: LintResult = {
      findings: [
        { fix: [], fixable: true, message: 'm', pm: 'npm', ruleId: 'a', severity: 'error' },
        { fix: [], fixable: true, message: 'm', pm: 'npm', ruleId: 'b', severity: 'warn' },
        { fix: [], fixable: false, message: 'm', pm: 'npm', ruleId: 'c', severity: 'info' },
      ],
      summary: { error: 1, info: 1, warn: 1 },
    };
    const { io, out } = captureIO();
    jsonReporter.format(tri, io);
    const parsed = JSON.parse(out());
    expect(parsed.findings).toHaveLength(FINDING_COUNT);
    expect(parsed.summary).toStrictEqual({ error: 1, info: 1, warn: 1 });
  });
});

describe('githubReporter — basic annotations', () => {
  it('produces one GitHub workflow annotation per finding', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    githubReporter.format(result, io);
    const lines = out()
      .split('\n')
      .filter((line) => line.length > EMPTY);
    expect(lines).toHaveLength(SINGLE_FINDING);
    const firstLine = lines[FIRST_LINE];
    assert(firstLine, 'expected at least one line');
    expect(parseGithubAnnotation(firstLine)).toStrictEqual({
      body: '[npm] set ignore-scripts',
      command: 'error',
      props: { file: '.npmrc', title: 'disable-lifecycle-scripts' },
    });
  });

  it('does not leave a dangling empty link when a finding has no docs URL', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    githubReporter.format(result, io);
    const annotation = parseGithubAnnotation(firstLineOf(out()));
    expect(annotation.body).toBe('[npm] set ignore-scripts');
    expect(annotation.body).not.toMatch(/\(\)/u);
    expect(annotation.body).not.toMatch(/ $/u);
  });
});

describe('githubReporter — docs links', () => {
  it('lets PR reviewers jump to the upstream docs straight from the annotation', () => {
    expect.hasAssertions();
    const withDocs: LintResult = {
      findings: [
        {
          docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts',
          file: '.npmrc',
          fix: [],
          fixable: true,
          message: 'set ignore-scripts',
          pm: 'npm',
          ruleId: 'disable-lifecycle-scripts',
          severity: 'error',
        },
      ],
      summary: { error: 1, info: 0, warn: 0 },
    };
    const { io, out } = captureIO();
    githubReporter.format(withDocs, io);
    const annotation = parseGithubAnnotation(firstLineOf(out()));
    expect(annotation.body).toBe(
      '[npm] set ignore-scripts (https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts)',
    );
  });
});

describe('githubReporter — severity mapping', () => {
  it('maps each severity to its workflow-command keyword (error / warning / notice)', () => {
    expect.hasAssertions();
    const cases: { severity: 'error' | 'warn' | 'info'; expected: string }[] = [
      { expected: 'error', severity: 'error' },
      { expected: 'warning', severity: 'warn' },
      { expected: 'notice', severity: 'info' },
    ];
    for (const tc of cases) {
      const single: LintResult = {
        findings: [
          {
            file: '.npmrc',
            fix: [],
            fixable: true,
            message: 'msg',
            pm: 'npm',
            ruleId: 'disable-lifecycle-scripts',
            severity: tc.severity,
          },
        ],
        summary: { error: 0, info: 0, warn: 0 },
      };
      const { io, out } = captureIO();
      githubReporter.format(single, io);
      const line = firstLineOf(out());
      expect(parseGithubAnnotation(line).command).toBe(tc.expected);
    }
  });
});

describe('githubReporter — special characters', () => {
  it('keeps special characters in messages and paths from being reinterpreted by GitHub', () => {
    expect.hasAssertions();
    const tricky: LintResult = {
      findings: [
        {
          file: 'path/with,comma.txt',
          fix: [],
          fixable: true,
          message: 'set foo=bar, baz: 100%\nnext line',
          pm: 'npm',
          ruleId: 'disable-lifecycle-scripts',
          severity: 'error',
        },
      ],
      summary: { error: 1, info: 0, warn: 0 },
    };
    const { io, out } = captureIO();
    githubReporter.format(tricky, io);
    const line = out().trimEnd();
    expect(line).toContain('file=path/with%2Ccomma.txt');
    expect(line).not.toMatch(/file=path\/with,comma\.txt/u);
    expect(line).toContain('100%25');
    expect(line).toContain('%0Anext line');
    expect(line).not.toMatch(/\n/u);
  });
});

describe('prettyReporter — success output', () => {
  it('emits a non-empty success indicator when there are no findings', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    prettyReporter.format({ findings: [], summary: { error: 0, info: 0, warn: 0 } }, io);
    expect(out().trim()).not.toBe('');
    expect(out()).toMatch(/no .+(?<kind>issues|findings|problems)/iu);
  });
});

describe('prettyReporter — colour handling', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('emits ANSI colour codes when FORCE_COLOR is set', () => {
    expect.hasAssertions();
    vi.stubEnv('FORCE_COLOR', '1');
    vi.stubEnv('NO_COLOR', JSON.parse('{}')._);
    const { io, out } = captureIO();
    prettyReporter.format(result, io);
    expect(out()).toContain(ESC_OPEN);
  });

  it('treats NO_COLOR="" as absent per no-color.org (only non-empty disables)', () => {
    expect.hasAssertions();
    // Per https://no-color.org/, NO_COLOR must only suppress colour when
    // "present and not an empty string". An earlier `'NO_COLOR' in env`
    // check misread the spec and treated `NO_COLOR=''` as a kill switch,
    // silencing colour for any CI that exports the var unconditionally.
    vi.stubEnv('FORCE_COLOR', '1');
    vi.stubEnv('NO_COLOR', '');
    const { io, out } = captureIO();
    prettyReporter.format(result, io);
    expect(out()).toContain(ESC_OPEN);
  });

  it('honours NO_COLOR even when FORCE_COLOR is set (no-color.org wins)', () => {
    expect.hasAssertions();
    vi.stubEnv('FORCE_COLOR', '1');
    vi.stubEnv('NO_COLOR', '1');
    const { io, out } = captureIO();
    prettyReporter.format(result, io);
    expect(out()).not.toContain(ESC_OPEN);
    expect(out()).toContain('disable-lifecycle-scripts');
  });
});

describe('prettyReporter — layout', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a finding with rule id, pm tag, message, docs link, and summary line', () => {
    expect.hasAssertions();
    const withDocs: LintResult = {
      findings: [
        {
          docs: 'https://example.com/docs/ignore-scripts',
          file: '.npmrc',
          fix: [],
          fixable: true,
          message: 'set ignore-scripts',
          pm: 'npm',
          ruleId: 'disable-lifecycle-scripts',
          severity: 'error',
        },
      ],
      summary: { error: 1, info: 0, warn: 0 },
    };
    vi.stubEnv('NO_COLOR', '1');
    const { io, out } = captureIO();
    prettyReporter.format(withDocs, io);
    const output = out();
    expect(output).toContain('disable-lifecycle-scripts');
    expect(output).toContain('[npm]');
    expect(output).toContain('set ignore-scripts');
    expect(output).toContain('→ https://example.com/docs/ignore-scripts');
    expect(output).toMatch(/Summary:\s+1 error,\s+0 warn,\s+0 info/u);
  });
});
