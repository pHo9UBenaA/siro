import {
  getEntryById,
  getStateForAxis,
  listStateAxes,
  parseAxes,
  parseDecisions,
  parseRejected,
} from '../../scripts/review/lib/ctx.ts';
import assert from 'node:assert';

vi.setConfig({ testTimeout: 5000 });

const CLEAN_RUN_ONE = 1;
const CLEAN_RUN_TWO = 2;
const CLEAN_RUN_ZERO = 0;

const REJECTED_SINGLE = [
  '## R01 — pin-literal-source-close',
  '',
  '**Suggested.** Add a literal-source assertion.',
  '',
  '**Why rejected.** Brittle.',
  '',
].join('\n');

const REJECTED_MULTI = [
  '## R01 — slug-one',
  '',
  'First. Second.',
  '',
  '## R02 — slug-two',
  '',
  'Other.',
  '',
].join('\n');

const REJECTED_ONELINE_MARKER = [
  '## R10 — JSDoc-or-comment-for-self-explanatory-code',
  '',
  '**Suggested.** Add a docstring to `<function>` describing what it does.',
  '',
  '**Why rejected.** CLAUDE.md says…',
  '',
].join('\n');

const REJECTED_ABBREVIATION = [
  '## R11 — extraction-threshold',
  '',
  '**Suggested.** Extract after three call sites, e.g. the codec helpers, not before.',
  '',
].join('\n');

describe(parseRejected, () => {
  it('returns one {id, slug, oneline} for a single entry', () => {
    expect.hasAssertions();
    expect(parseRejected(REJECTED_SINGLE)).toStrictEqual([
      {
        id: 'R01',
        oneline: 'Add a literal-source assertion.',
        slug: 'pin-literal-source-close',
      },
    ]);
  });

  it('returns multiple entries in source order', () => {
    expect.hasAssertions();
    const entries = parseRejected(REJECTED_MULTI);
    expect(entries.map((entry) => entry.id)).toStrictEqual(['R01', 'R02']);
    expect(entries.map((entry) => entry.slug)).toStrictEqual(['slug-one', 'slug-two']);
  });

  it('returns [] for empty input', () => {
    expect.hasAssertions();
    expect(parseRejected('')).toStrictEqual([]);
  });

  it('ignores ## headings that do not match the R<NN> — <slug> pattern', () => {
    expect.hasAssertions();
    const md = ['## Not an entry', '', 'body.', '', '## R03 — keeper', '', 'kept.', ''].join('\n');
    expect(parseRejected(md).map((entry) => entry.id)).toStrictEqual(['R03']);
  });

  it('uses the first sentence of the body as oneline (skipping leading `**X.**` markers)', () => {
    expect.hasAssertions();
    const [entry] = parseRejected(REJECTED_ONELINE_MARKER);
    assert(entry, 'expected a parsed entry');
    expect(entry.oneline).toBe('Add a docstring to `<function>` describing what it does.');
  });

  it('does not truncate the oneline at an abbreviation like "e.g."', () => {
    expect.hasAssertions();
    const [entry] = parseRejected(REJECTED_ABBREVIATION);
    assert(entry, 'expected a parsed entry');
    expect(entry.oneline).toBe(
      'Extract after three call sites, e.g. the codec helpers, not before.',
    );
  });
});

describe(parseDecisions, () => {
  it('returns {id, title, oneline} for D<NN> — <title> entries', () => {
    expect.hasAssertions();
    const md = [
      '## D01 — Hexagonal layering enforced by a deterministic gate',
      '',
      '**Context.** The src tree is split into layers.',
      '',
    ].join('\n');
    expect(parseDecisions(md)).toStrictEqual([
      {
        id: 'D01',
        oneline: 'The src tree is split into layers.',
        title: 'Hexagonal layering enforced by a deterministic gate',
      },
    ]);
  });

  it('keeps backticks in the title verbatim (titles may quote symbol names)', () => {
    expect.hasAssertions();
    const md = ['## D03 — `RuleBinding.fix` return shape is constrained', '', 'body.', ''].join(
      '\n',
    );
    const first = parseDecisions(md)[CLEAN_RUN_ZERO];
    assert(first, 'expected a parsed decision');
    expect(first.title).toBe('`RuleBinding.fix` return shape is constrained');
  });
});

describe(parseAxes, () => {
  it('returns {id, axis, oneline} for ### <N>. `<axis>` entries', () => {
    expect.hasAssertions();
    const md = [
      '### 1. `correctness`',
      '',
      'What it finds: bugs.',
      '',
      '### 2. `architecture-drift`',
      '',
      'What it finds: layering violations.',
      '',
    ].join('\n');
    expect(parseAxes(md)).toStrictEqual([
      { axis: 'correctness', id: '1', oneline: 'What it finds: bugs.' },
      { axis: 'architecture-drift', id: '2', oneline: 'What it finds: layering violations.' },
    ]);
  });

  it('ignores ### headings without the numbered-axis pattern', () => {
    expect.hasAssertions();
    const md = [
      '### 1. `correctness`',
      '',
      'bugs.',
      '',
      '### Observations — sub-finding notes',
      '',
      'docs.',
      '',
    ].join('\n');
    expect(parseAxes(md).map((entry) => entry.axis)).toStrictEqual(['correctness']);
  });
});

const ENTRY_BY_ID_TWO = [
  '## R01 — alpha',
  '',
  'Alpha body.',
  '',
  '## R02 — beta',
  '',
  'Beta body.',
  '',
].join('\n');

const ENTRY_BY_ID_SUBSECTION = [
  '## R01 — alpha',
  '',
  '### subsection',
  '',
  'subbody.',
  '',
  '## R02 — beta',
  '',
  'beta body.',
  '',
].join('\n');

describe(getEntryById, () => {
  it('returns heading + body for the matching slug (REJECTED)', () => {
    expect.hasAssertions();
    expect(getEntryById(ENTRY_BY_ID_TWO, { id: 'alpha', kind: 'rejected' })).toBe(
      '## R01 — alpha\n\nAlpha body.\n',
    );
  });

  it('returns undefined for an unknown id', () => {
    expect.hasAssertions();
    const md = '## R01 — alpha\n\nbody.\n';
    expect(getEntryById(md, { id: 'gamma', kind: 'rejected' })).toBeUndefined();
  });

  it('accepts either the numeric id (R01) or the slug as the lookup key', () => {
    expect.hasAssertions();
    const md = '## R01 — alpha\n\nbody.\n';
    expect(getEntryById(md, { id: 'R01', kind: 'rejected' })).toContain('alpha');
    expect(getEntryById(md, { id: 'alpha', kind: 'rejected' })).toContain('R01');
  });

  it('extends the body to EOF when no next same-level heading exists', () => {
    expect.hasAssertions();
    const md = '## R01 — only\n\nfirst.\nsecond.\n';
    const entry = getEntryById(md, { id: 'only', kind: 'rejected' });
    expect(entry).toBe('## R01 — only\n\nfirst.\nsecond.\n');
  });

  it('does NOT cross ## boundaries even when ### subheadings appear inside', () => {
    expect.hasAssertions();
    const entry = getEntryById(ENTRY_BY_ID_SUBSECTION, { id: 'alpha', kind: 'rejected' });
    assert(entry, 'expected an entry');
    expect(entry).toContain('### subsection');
    expect(entry).not.toContain('beta body');
  });
});

describe(getStateForAxis, () => {
  const stateJson = JSON.stringify({
    correctness: {
      clean_run_count: CLEAN_RUN_ONE,
      head_sha: 'abc',
      round_verdict: 'clean',
    },
    'perf-hotspot': {
      clean_run_count: CLEAN_RUN_TWO,
      head_sha: 'def',
      round_verdict: 'clean',
    },
  });

  it('returns the parsed entry for a known axis', () => {
    expect.hasAssertions();
    expect(getStateForAxis(stateJson, 'correctness')).toStrictEqual({
      clean_run_count: CLEAN_RUN_ONE,
      head_sha: 'abc',
      round_verdict: 'clean',
    });
  });

  it('returns undefined for an unknown axis', () => {
    expect.hasAssertions();
    expect(getStateForAxis(stateJson, 'nonexistent')).toBeUndefined();
  });
});

describe(listStateAxes, () => {
  it('returns a terse summary per axis', () => {
    expect.hasAssertions();
    const stateJson = JSON.stringify({
      correctness: {
        clean_run_count: CLEAN_RUN_ONE,
        findings: [{ id: 'never-shown' }],
        head_sha: 'abc',
        round_verdict: 'clean',
      },
    });
    expect(listStateAxes(stateJson)).toStrictEqual([
      {
        axis: 'correctness',
        clean_run_count: CLEAN_RUN_ONE,
        head_sha: 'abc',
        round_verdict: 'clean',
      },
    ]);
  });

  it('returns [] for an empty state file', () => {
    expect.hasAssertions();
    expect(listStateAxes('{}')).toStrictEqual([]);
  });
});
