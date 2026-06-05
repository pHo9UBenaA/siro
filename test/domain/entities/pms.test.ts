import { SEVERITIES, SEVERITY_RANK } from '../../../src/domain/entities/pms.ts';

vi.setConfig({ testTimeout: 5000 });

describe('severity rank', () => {
  it('orders error > warn > info so filter and exit-code logic can share one source of truth', () => {
    expect.hasAssertions();
    expect(SEVERITY_RANK.error).toBeGreaterThan(SEVERITY_RANK.warn);
    expect(SEVERITY_RANK.warn).toBeGreaterThan(SEVERITY_RANK.info);
  });

  it('covers every Severity value exactly once', () => {
    expect.hasAssertions();
    expect(Object.keys(SEVERITY_RANK).toSorted()).toStrictEqual([...SEVERITIES].toSorted());
  });
});
