import { getObservationBySlug } from '../../scripts/review/lib/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

describe('getObservationBySlug boundary', () => {
  it('stops at an H1 heading, matching parseObservations', () => {
    expect.hasAssertions();
    const md = ['## 2026-06-13 — spot-check — some-slug', '', 'note body.', '# Appendix', 'x'].join(
      '\n',
    );
    expect(getObservationBySlug(md, 'some-slug')).toBe(
      '## 2026-06-13 — spot-check — some-slug\n\nnote body.\n',
    );
  });
});
