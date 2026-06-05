import { isPublishable } from '../../../src/domain/rules/publishable.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

describe(isPublishable, () => {
  it('treats a missing package.json as non-publishable', () => {
    expect.hasAssertions();
    expect(isPublishable(makeCtx({ packageJson: void 0 }))).toBe(false);
  });

  it('treats `private: true` as non-publishable even when named', () => {
    expect.hasAssertions();
    expect(isPublishable(makeCtx({ packageJson: { name: 'demo', private: true } }))).toBe(false);
  });

  it('treats a nameless package as non-publishable', () => {
    expect.hasAssertions();
    expect(isPublishable(makeCtx({ packageJson: {} }))).toBe(false);
  });

  it('treats an empty-string name as non-publishable', () => {
    expect.hasAssertions();
    // npm itself rejects empty names; siro must not classify such a
    // package.json as publishable and emit false-positive `files`/
    // `publish-access` findings.
    expect(isPublishable(makeCtx({ packageJson: { name: '' } }))).toBe(false);
  });

  it('treats a named, non-private package as publishable', () => {
    expect.hasAssertions();
    expect(isPublishable(makeCtx({ packageJson: { name: 'demo' } }))).toBe(true);
  });

  it('treats an explicit `private: false` as publishable when named', () => {
    expect.hasAssertions();
    expect(isPublishable(makeCtx({ packageJson: { name: 'demo', private: false } }))).toBe(true);
  });
});
