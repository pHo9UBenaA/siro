import { formatLedgerEntry, formatObservationEntry } from '../../scripts/review/lib/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

describe('heading-shaped line injection guards', () => {
  it('rejects an observation note containing a line that starts with "## "', () => {
    expect.hasAssertions();
    expect(() =>
      formatObservationEntry({
        axis: 'correctness',
        date: '2026-06-12',
        note: 'first line\n## 2026-01-01 — fake — injected',
        slug: 'some-slug',
      }),
    ).toThrow(/## /u);
  });

  it('rejects a ledger body containing a line that starts with "## "', () => {
    expect.hasAssertions();
    expect(() =>
      formatLedgerEntry({
        body: 'prose\n## R100 — injected',
        id: 'R99',
        kind: 'rejected',
        title: 'some-title',
      }),
    ).toThrow(/## /u);
  });
});
