import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

const CTX = path.join(import.meta.dirname, '..', '..', 'scripts', 'review', 'ctx.mjs');

const EXIT_SUCCESS = 0;
const EXIT_USAGE = 2;
const CLEAN_RUN_COUNT_ONE = 1;
const CLEAN_RUN_COUNT_TWO = 2;
const JSON_INDENT = 2;
const IDENTITY_REPLACER = (_key: string, value: unknown): unknown => value;

const run = (args: string[], opts?: { stdin?: string }): SpawnSyncReturns<string> => {
  let input = '';
  if (opts) {
    input = opts.stdin ?? '';
  }
  return spawnSync(process.execPath, [CTX, ...args], {
    encoding: 'utf8',
    input,
  });
};

const obsAppendArgs = (opts: { date: string; slug: string; target: string }): string[] => [
  'observations',
  'append',
  '--axis',
  'correctness',
  '--slug',
  opts.slug,
  '--date',
  opts.date,
  '--path',
  opts.target,
];

describe('observations append — create and append', () => {
  let tempDir = '';
  let target = '';

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'siro-ctx-obs-'));
    target = path.join(tempDir, 'OBSERVATIONS.md');
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it('creates the file and writes a formatted entry when the target does not exist', () => {
    expect.hasAssertions();
    const result = run(obsAppendArgs({ date: '2026-06-08', slug: 'my-slug', target }), {
      stdin: 'A short observation.\n',
    });
    expect(result.status).toBe(EXIT_SUCCESS);
    const md = readFileSync(target, 'utf8');
    expect(md).toContain('## 2026-06-08 — correctness — my-slug');
    expect(md).toContain('A short observation.');
  });

  it('appends to an existing file preserving its prior content', () => {
    expect.hasAssertions();
    writeFileSync(target, '# Observations log\n\nintro\n');
    const result = run(obsAppendArgs({ date: '2026-06-08', slug: 'slug-a', target }), {
      stdin: 'note.\n',
    });
    expect(result.status).toBe(EXIT_SUCCESS);
    const md = readFileSync(target, 'utf8');
    expect(md.startsWith('# Observations log\n\nintro')).toBe(true);
    expect(md).toContain('## 2026-06-08 — correctness — slug-a');
  });
});

describe('observations append — validation', () => {
  let tempDir = '';
  let target = '';

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'siro-ctx-obs-'));
    target = path.join(tempDir, 'OBSERVATIONS.md');
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it('exits 2 when stdin is empty', () => {
    expect.hasAssertions();
    const result = run(
      [
        'observations',
        'append',
        '--axis',
        'correctness',
        '--slug',
        'slug-a',
        '--date',
        '2026-06-08',
        '--path',
        target,
      ],
      { stdin: '' },
    );
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('stdin');
  });

  it('exits 2 when a required flag is missing', () => {
    expect.hasAssertions();
    const result = run(['observations', 'append', '--axis', 'correctness', '--path', target], {
      stdin: 'note.\n',
    });
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('required');
  });
});

describe('ledger append — write', () => {
  let tempDir = '';
  let target = '';

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'siro-ctx-ledger-'));
    target = path.join(tempDir, 'REJECTED.md');
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it('returns the assigned R<NN> id on stdout and writes the entry', () => {
    expect.hasAssertions();
    writeFileSync(target, '# Rejected\n\nintro\n\n## R01 — first\n\nbody.\n');
    const result = run(
      ['ledger', 'append', '--kind', 'rejected', '--title', 'new-slug', '--path', target],
      { stdin: '**Suggested.** something.\n\n**Why rejected.** reason.\n' },
    );
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout.trim()).toBe('R02');
    const after = readFileSync(target, 'utf8');
    expect(after).toContain('## R02 — new-slug');
    expect(after).toContain('**Why rejected.** reason.');
    expect(after).toContain('## R01 — first');
    expect(after).toContain('intro');
  });

  it('assigns D<NN> when --kind is decisions', () => {
    expect.hasAssertions();
    writeFileSync(target, '# Decisions\n\n## D01 — one\n\nbody.\n');
    const result = run(
      ['ledger', 'append', '--kind', 'decisions', '--title', 'two', '--path', target],
      { stdin: '**Context.** ctx.\n**Decision.** dec.\n' },
    );
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout.trim()).toBe('D02');
  });

  it('writes the first entry as R01 / D01 when the target file does not yet exist', () => {
    expect.hasAssertions();
    const result = run(
      ['ledger', 'append', '--kind', 'rejected', '--title', 'inaugural', '--path', target],
      { stdin: 'first body.\n' },
    );
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout.trim()).toBe('R01');
    const after = readFileSync(target, 'utf8');
    expect(after.startsWith('## R01 — inaugural')).toBe(true);
  });
});

describe('ledger append — validation', () => {
  let tempDir = '';
  let target = '';

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'siro-ctx-ledger-'));
    target = path.join(tempDir, 'REJECTED.md');
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it('exits 2 when --kind is not rejected or decisions', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'append', '--kind', 'axes', '--title', 'tt', '--path', target], {
      stdin: 'body.',
    });
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('rejected or decisions');
  });

  it('exits 2 when --title is missing', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'append', '--kind', 'rejected', '--path', target], {
      stdin: 'body.',
    });
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('--title');
  });

  it('exits 2 when stdin is empty', () => {
    expect.hasAssertions();
    const result = run(
      ['ledger', 'append', '--kind', 'rejected', '--title', 'tt', '--path', target],
      { stdin: '' },
    );
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('stdin');
  });
});

const assertStateSetCreatesEntry = (target: string): void => {
  const result = run(['state', 'set', '--axis', 'correctness', '--path', target], {
    stdin: JSON.stringify({
      clean_run_count: CLEAN_RUN_COUNT_ONE,
      head_sha: 'abc',
      round_verdict: 'clean',
    }),
  });
  expect(result.status).toBe(EXIT_SUCCESS);
  const parsed = JSON.parse(readFileSync(target, 'utf8'));
  expect(parsed.correctness).toStrictEqual({
    clean_run_count: CLEAN_RUN_COUNT_ONE,
    head_sha: 'abc',
    round_verdict: 'clean',
  });
};

const assertStateSetReplacesSibling = (target: string): void => {
  writeFileSync(
    target,
    JSON.stringify(
      {
        correctness: { head_sha: 'old' },
        'perf-hotspot': { clean_run_count: CLEAN_RUN_COUNT_TWO, head_sha: 'pinned' },
      },
      IDENTITY_REPLACER,
      JSON_INDENT,
    ),
  );
  const result = run(['state', 'set', '--axis', 'correctness', '--path', target], {
    stdin: JSON.stringify({ clean_run_count: CLEAN_RUN_COUNT_TWO, head_sha: 'new' }),
  });
  expect(result.status).toBe(EXIT_SUCCESS);
  const parsed = JSON.parse(readFileSync(target, 'utf8'));
  expect(parsed.correctness).toStrictEqual({
    clean_run_count: CLEAN_RUN_COUNT_TWO,
    head_sha: 'new',
  });
  expect(parsed['perf-hotspot']).toStrictEqual({
    clean_run_count: CLEAN_RUN_COUNT_TWO,
    head_sha: 'pinned',
  });
};

describe('state set — write', () => {
  let tempDir = '';
  let target = '';

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'siro-ctx-state-'));
    target = path.join(tempDir, 'state.json');
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it('writes an entry when the target does not exist', () => {
    expect.hasAssertions();
    assertStateSetCreatesEntry(target);
  });

  it('replaces only the named axis, leaving siblings intact', () => {
    expect.hasAssertions();
    assertStateSetReplacesSibling(target);
  });
});

describe('state set — validation', () => {
  let tempDir = '';
  let target = '';

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'siro-ctx-state-'));
    target = path.join(tempDir, 'state.json');
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it('exits 2 with a useful error when stdin is not valid JSON', () => {
    expect.hasAssertions();
    const result = run(['state', 'set', '--axis', 'correctness', '--path', target], {
      stdin: '{ not json',
    });
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('not valid JSON');
  });
});
