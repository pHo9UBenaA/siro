import { formatLedgerEntry, formatObservationEntry } from '../../scripts/review/lib/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

describe('formatObservationEntry heading guards', () => {
  it('rejects a note line that reads as an h1 heading to the boundary parser', () => {
    expect.hasAssertions();
    expect(() =>
      formatObservationEntry({
        axis: 'correctness',
        date: '2026-06-13',
        note: '# h\nx',
        slug: 's',
      }),
    ).toThrow(/lines starting with/u);
  });
  it('rejects a file ref containing a newline', () => {
    expect.hasAssertions();
    expect(() =>
      formatObservationEntry({
        axis: 'correctness',
        date: '2026-06-13',
        file: 'a\nb',
        note: 'ok',
        slug: 's',
      }),
    ).toThrow(/file ref/u);
  });
});

describe('formatLedgerEntry heading guards', () => {
  it('rejects a body line that reads as an h1 heading to the boundary parser', () => {
    expect.hasAssertions();
    expect(() =>
      formatLedgerEntry({ body: '# h\n', id: 'R99', kind: 'rejected', title: 't' }),
    ).toThrow(/lines starting with/u);
  });
});
