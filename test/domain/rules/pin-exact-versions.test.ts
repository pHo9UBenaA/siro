import { makeCtx } from '../../helpers/ctx.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';

vi.setConfig({ testTimeout: 5000 });

describe('pin-exact-versions (npm)', () => {
  const ctx = makeCtx();
  const { npm } = pinExactVersions.bindings;
  if (!npm) {
    throw new TypeError('expected npm binding');
  }

  it('is an error-severity rule targeting .npmrc', () => {
    expect.hasAssertions();
    expect(pinExactVersions.severity).toBe('error');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('flags a violation when save-exact is not enabled', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, {}).state).toBe('violation');
    expect(npm.check(ctx, { 'save-exact': false }).state).toBe('violation');
  });

  it('flags a violation when save-exact alone is set (save-prefix still defaulting to ^)', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, { 'save-exact': true }).state).toBe('violation');
  });

  it('still flags a violation when save-exact=true but save-prefix is non-empty', () => {
    expect.hasAssertions();
    const result = npm.check(ctx, { 'save-exact': true, 'save-prefix': '^' });
    expect(result.state).toBe('violation');
  });

  it('passes when save-exact=true and save-prefix is empty', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, { 'save-exact': true, 'save-prefix': '' }).state).toBe('ok');
  });

  it('fixes by setting save-exact=true and save-prefix=""', () => {
    expect.hasAssertions();
    const ops = npm.fix(ctx);
    expect(ops).toContainEqual({
      file: { kind: 'npmrc', path: '.npmrc' },
      keyPath: ['save-exact'],
      op: 'setKey',
      value: true,
    });
    expect(ops).toContainEqual({
      file: { kind: 'npmrc', path: '.npmrc' },
      keyPath: ['save-prefix'],
      op: 'setKey',
      value: '',
    });
  });
});
