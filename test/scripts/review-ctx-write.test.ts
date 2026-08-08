import {
  appendLedgerEntry,
  appendObservation,
  formatLedgerEntry,
  formatObservationEntry,
  getObservationBySlug,
  nextLedgerId,
  parseObservations,
  updateState,
} from '../../scripts/review/lib/ctx.ts';
import assert from 'node:assert';

vi.setConfig({ testTimeout: 5000 });

const JSON_INDENT = 2;
const IDENTITY_REPLACER = (_key: string, value: unknown): unknown => value;

describe(formatObservationEntry, () => {
  it('produces a heading line + blank line + body in the OBSERVATIONS.md format', () => {
    expect.hasAssertions();
    const md = formatObservationEntry({
      axis: 'correctness',
      date: '2026-06-08',
      note: 'A note about a thing.',
      slug: 'my-slug',
    });
    expect(md).toBe('## 2026-06-08 — correctness — my-slug\n\nA note about a thing.\n');
  });

  it('appends a file:line reference on its own trailing line when given', () => {
    expect.hasAssertions();
    const md = formatObservationEntry({
      axis: 'correctness',
      date: '2026-06-08',
      file: 'src/foo.ts:42',
      note: 'note.',
      slug: 's',
    });
    expect(md).toBe('## 2026-06-08 — correctness — s\n\nnote.\n\n`src/foo.ts:42`\n');
  });

  it('rejects inputs with markdown control characters in slug or axis', () => {
    expect.hasAssertions();
    expect(() =>
      formatObservationEntry({
        axis: 'correctness',
        date: '2026-06-08',
        note: 'note.',
        slug: 'bad\nslug',
      }),
    ).toThrow(/slug/u);
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect.hasAssertions();
    expect(() =>
      formatObservationEntry({ axis: 'correctness', date: 'today', note: 'n.', slug: 's' }),
    ).toThrow(/date/iu);
  });
});

describe(appendObservation, () => {
  it('appends the new entry preserving the existing content', () => {
    expect.hasAssertions();
    const before = '# Observations log\n\nintro\n';
    const after = appendObservation(before, '## 2026-06-08 — correctness — x\n\nbody.\n');
    expect(after.startsWith(before)).toBe(true);
    expect(after.endsWith('## 2026-06-08 — correctness — x\n\nbody.\n')).toBe(true);
  });

  it('inserts the new entry after a blank-line separator even when the existing content has no trailing blank line', () => {
    expect.hasAssertions();
    const before = '# Observations log\n\nintro';
    const after = appendObservation(before, '## 2026-06-08 — correctness — x\n\nbody.\n');
    expect(after).toContain('intro\n\n## 2026-06-08');
  });

  it('does not double-blank-line when the existing content already ends with a blank line', () => {
    expect.hasAssertions();
    const before = '# Observations log\n\nintro\n\n';
    const after = appendObservation(before, '## 2026-06-08 — correctness — x\n\nbody.\n');
    expect(after).not.toContain('\n\n\n## 2026-06-08');
  });

  it('does not prefix a blank-line separator when the existing content is empty', () => {
    expect.hasAssertions();
    expect(appendObservation('', '## 2026-06-08 — correctness — x\n\nbody.\n')).toBe(
      '## 2026-06-08 — correctness — x\n\nbody.\n',
    );
  });
});

const OBSERVATIONS_LOG =
  '# Observations log\n\nintro\n\n---\n\n' +
  '## 2026-06-08 — correctness — first-slug\n\nA first note. A second sentence.\n\n' +
  '## 2026-06-09 — docs-sync — second-slug\n\nOther note.\n';

describe(parseObservations, () => {
  it('returns {date, axis, slug, oneline} for ## YYYY-MM-DD — <axis> — <slug> headings', () => {
    expect.hasAssertions();
    expect(parseObservations(OBSERVATIONS_LOG)).toStrictEqual([
      {
        axis: 'correctness',
        date: '2026-06-08',
        oneline: 'A first note.',
        slug: 'first-slug',
      },
      {
        axis: 'docs-sync',
        date: '2026-06-09',
        oneline: 'Other note.',
        slug: 'second-slug',
      },
    ]);
  });

  it('returns [] when the log has no entries', () => {
    expect.hasAssertions();
    expect(parseObservations('# Observations log\n\nintro\n')).toStrictEqual([]);
  });

  it('ignores ## headings that do not match the date-axis-slug pattern', () => {
    expect.hasAssertions();
    const md = [
      '## Some intro section',
      '',
      'body.',
      '',
      '## 2026-06-08 — axis — s',
      '',
      'n.',
    ].join('\n');
    expect(parseObservations(md).map((entry) => entry.slug)).toStrictEqual(['s']);
  });
});

describe(getObservationBySlug, () => {
  const md = [
    '# Observations log',
    '',
    '## 2026-06-08 — correctness — alpha',
    '',
    'Alpha note.',
    '',
    '## 2026-06-09 — docs-sync — beta',
    '',
    'Beta note.',
    '',
  ].join('\n');

  it('returns the heading + body for a matching slug', () => {
    expect.hasAssertions();
    const entry = getObservationBySlug(md, 'alpha');
    expect(entry).toBe('## 2026-06-08 — correctness — alpha\n\nAlpha note.\n');
  });

  it('returns undefined for an unknown slug', () => {
    expect.hasAssertions();
    expect(getObservationBySlug(md, 'no-such')).toBeUndefined();
  });

  it('returns the LAST entry with that slug when duplicates exist', () => {
    expect.hasAssertions();
    const dup = [
      '## 2026-06-01 — correctness — same',
      '',
      'old note.',
      '',
      '## 2026-06-08 — correctness — same',
      '',
      'new note.',
      '',
    ].join('\n');
    const entry = getObservationBySlug(dup, 'same');
    assert(entry, 'expected an observation');
    expect(entry).toContain('new note');
    expect(entry).not.toContain('old note');
  });
});

const TWO_REJECTED_ENTRIES = '## R01 — a\n\na\n\n## R02 — b\n\nb\n';
const SPARSE_REJECTED = '## R03 — a\n\na\n\n## R05 — c\n\nc\n';
const INTRO_PLUS_ENTRY = '## Some intro\n\ni\n\n## R02 — real\n\nr\n';
const FAKE_HEADING_ENTRY = '## R01 — a\n\n## R99 would be a future id, not real\n\na\n';

describe(nextLedgerId, () => {
  it('returns R01 / D01 when the ledger has no entries yet', () => {
    expect.hasAssertions();
    expect(nextLedgerId('', 'rejected')).toBe('R01');
    expect(nextLedgerId('# Rejected\n\nintro\n', 'rejected')).toBe('R01');
    expect(nextLedgerId('# Decisions\n', 'decisions')).toBe('D01');
  });

  it('returns max + 1 zero-padded to 2 digits', () => {
    expect.hasAssertions();
    expect(nextLedgerId(TWO_REJECTED_ENTRIES, 'rejected')).toBe('R03');
  });

  it('preserves a 2-digit pad even past 9', () => {
    expect.hasAssertions();
    expect(nextLedgerId('## R09 — last\n\nbody.\n', 'rejected')).toBe('R10');
  });

  it('expands beyond 2 digits when the max already has 3', () => {
    expect.hasAssertions();
    expect(nextLedgerId('## R100 — big\n\nbody.\n', 'rejected')).toBe('R101');
  });

  it('returns max + 1 even when ids are non-contiguous', () => {
    expect.hasAssertions();
    expect(nextLedgerId(SPARSE_REJECTED, 'rejected')).toBe('R06');
  });

  it('ignores ## headings that do not match the R<NN> / D<NN> pattern', () => {
    expect.hasAssertions();
    expect(nextLedgerId(INTRO_PLUS_ENTRY, 'rejected')).toBe('R03');
  });

  it('does not cross ledger kinds (R<NN> in a decisions input still returns D01)', () => {
    expect.hasAssertions();
    expect(nextLedgerId('## R05 — a\n\nbody.\n', 'decisions')).toBe('D01');
  });

  it('ignores a heading-shaped body line that lacks the em-dash separator', () => {
    expect.hasAssertions();
    expect(nextLedgerId(FAKE_HEADING_ENTRY, 'rejected')).toBe('R02');
  });
});

describe(formatLedgerEntry, () => {
  it('produces the canonical `## <ID> — <title>` heading + blank line + body', () => {
    expect.hasAssertions();
    const md = formatLedgerEntry({
      body: '**Context.** A thing happened.\n\n**Decision.** We chose X.\n',
      id: 'D12',
      kind: 'decisions',
      title: 'My new decision',
    });
    expect(md).toBe(
      '## D12 — My new decision\n\n**Context.** A thing happened.\n\n**Decision.** We chose X.\n',
    );
  });

  it('normalises a body without a trailing newline to end with one', () => {
    expect.hasAssertions();
    const md = formatLedgerEntry({
      body: '**Suggested.** Something.\n\n**Why rejected.** Reason.',
      id: 'R30',
      kind: 'rejected',
      title: 'short-slug',
    });
    expect(md.endsWith('Reason.\n')).toBe(true);
  });

  it('rejects ids that do not match the kind', () => {
    expect.hasAssertions();
    expect(() =>
      formatLedgerEntry({ body: 'b', id: 'R12', kind: 'decisions', title: 't' }),
    ).toThrow(/decisions.*D\\d/u);
    expect(() => formatLedgerEntry({ body: 'b', id: 'D12', kind: 'rejected', title: 't' })).toThrow(
      /rejected.*R\\d/u,
    );
  });

  it('rejects titles containing markdown control characters', () => {
    expect.hasAssertions();
    expect(() =>
      formatLedgerEntry({ body: 'b', id: 'D12', kind: 'decisions', title: 'bad\ntitle' }),
    ).toThrow(/title/u);
  });
});

describe(appendLedgerEntry, () => {
  it('appends the new entry preserving the existing content (similar to appendObservation)', () => {
    expect.hasAssertions();
    const before = '# Rejected\n\nintro\n\n## R01 — a\n\nbody.\n';
    const after = appendLedgerEntry(before, '## R02 — b\n\nnew body.\n');
    expect(after.startsWith(before.replace(/\n+$/u, ''))).toBe(true);
    expect(after.endsWith('## R02 — b\n\nnew body.\n')).toBe(true);
  });

  it('separates new entry with exactly one blank line regardless of source trailing whitespace', () => {
    expect.hasAssertions();
    const before = '# Rejected\n\nintro\n\n## R01 — a\n\nbody.';
    const after = appendLedgerEntry(before, '## R02 — b\n\nnew.\n');
    expect(after).toContain('body.\n\n## R02');
    expect(after).not.toContain('\n\n\n## R02');
  });
});

describe(updateState, () => {
  it('inserts a new axis entry into a previously-empty state', () => {
    expect.hasAssertions();
    const after = updateState('{}', 'correctness', {
      clean_run_count: 1,
      head_sha: 'abc',
      round_verdict: 'clean',
    });
    expect(JSON.parse(after).correctness).toStrictEqual({
      clean_run_count: 1,
      head_sha: 'abc',
      round_verdict: 'clean',
    });
  });

  it('replaces an existing axis entry, leaving sibling axes untouched', () => {
    expect.hasAssertions();
    const before = JSON.stringify(
      {
        correctness: { clean_run_count: 0, head_sha: 'old' },
        'perf-hotspot': { clean_run_count: 2, head_sha: 'pinned' },
      },
      IDENTITY_REPLACER,
      JSON_INDENT,
    );
    const after = updateState(before, 'correctness', { clean_run_count: 2, head_sha: 'new' });
    const parsed = JSON.parse(after);
    expect(parsed.correctness).toStrictEqual({ clean_run_count: 2, head_sha: 'new' });
    expect(parsed['perf-hotspot']).toStrictEqual({ clean_run_count: 2, head_sha: 'pinned' });
  });

  it('outputs 2-space indented JSON with a trailing newline (matching the existing file shape)', () => {
    expect.hasAssertions();
    const after = updateState('{}', 'correctness', { indent: 1 });
    expect(after.endsWith('\n')).toBe(true);
    expect(after).toContain('\n  "correctness"');
  });
});
