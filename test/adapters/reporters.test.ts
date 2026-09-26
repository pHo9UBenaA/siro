import {
  BUILTIN_REPORTER_NAMES,
  createRegistry,
  githubReporter,
  jsonReporter,
  prettyReporter,
} from '../../src/adapters/reporters/registry.ts';
import type { LintResult } from '../../src/core/contracts/lint-result.ts';
import { parseGithubAnnotation } from '../helpers/github-annotation.ts';
import { captureIO } from '../helpers/io.ts';

const ESC_OPEN = '[';

const result: LintResult = {
  findings: [
    {
      file: '.npmrc',

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
    expect([...registry.keys()]).toStrictEqual(
      expect.arrayContaining(['pretty', 'json', 'github', 'noop']),
    );
  });
});

describe('githubReporter — special characters', () => {
  it('keeps special characters in messages and paths from being reinterpreted by GitHub', () => {
    expect.hasAssertions();
    const tricky: LintResult = {
      findings: [
        {
          file: 'path/with,comma.txt',

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
    vi.stubEnv('NO_COLOR', undefined);
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

it('emits ordered annotations with severity, file and optional docs', () => {
  const { io, out } = captureIO();
  githubReporter.format(
    {
      findings: [
        { pm: 'npm', ruleId: 'first', severity: 'error', message: 'first message', file: '.npmrc' },
        {
          pm: 'pnpm',
          ruleId: 'second',
          severity: 'warn',
          message: 'second message',
          file: 'pnpm-workspace.yaml',
          docs: 'https://example.com/guide',
        },
        { pm: 'yarn', ruleId: 'third', severity: 'info', message: 'third message' },
      ],
      summary: { error: 1, warn: 1, info: 1 },
    },
    io,
  );
  expect(out().trim().split('\n').map(parseGithubAnnotation)).toEqual([
    { command: 'error', props: { file: '.npmrc', title: 'first' }, body: '[npm] first message' },
    {
      command: 'warning',
      props: { file: 'pnpm-workspace.yaml', title: 'second' },
      body: '[pnpm] second message (https://example.com/guide)',
    },
    { command: 'notice', props: { title: 'third' }, body: '[yarn] third message' },
  ]);
});
