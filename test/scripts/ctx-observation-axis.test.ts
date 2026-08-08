import { formatObservationEntry } from '../../scripts/review/lib/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

describe('formatObservationEntry axis validation', () => {
  it('rejects an axis containing whitespace (heading would be unparseable)', () => {
    expect.hasAssertions();
    expect(() =>
      formatObservationEntry({
        axis: 'spot check',
        date: '2026-06-12',
        note: 'note body',
        slug: 'some-slug',
      }),
    ).toThrow(/whitespace/u);
  });
});
