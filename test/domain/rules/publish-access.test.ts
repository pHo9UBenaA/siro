import assert from 'node:assert';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { publishAccess } from '../../../src/domain/rules/publish-access.ts';

vi.setConfig({ testTimeout: 5000 });

const { npm } = publishAccess.bindings;
if (!npm) {
  throw new TypeError('expected npm binding');
}

describe('publish-access (npm)', () => {
  it('is info-severity, targets package.json', () => {
    expect.hasAssertions();
    expect(publishAccess.severity).toBe('info');
    expect(npm.file).toStrictEqual({ kind: 'json', path: 'package.json' });
  });

  it('is N/A for private packages', () => {
    expect.hasAssertions();
    expect(npm.check(ctx({ packageJson: { private: true } }), {}).state).toBe('na');
  });

  it('flags a violation when publishConfig.access is missing', () => {
    expect.hasAssertions();
    expect(npm.check(ctx(), {}).state).toBe('violation');
  });

  it('passes for "public" or "restricted"', () => {
    expect.hasAssertions();
    const passes = (access: 'public' | 'restricted'): string =>
      npm.check(ctx({ packageJson: { publishConfig: { access } } }), {}).state;
    expect(passes('public')).toBe('ok');
    expect(passes('restricted')).toBe('ok');
  });

  it('fix is advisory (a note)', () => {
    expect.hasAssertions();
    const ops = npm.fix(ctx());
    const FIRST_ELEMENT = 0;
    const firstOp = ops[FIRST_ELEMENT];
    assert(firstOp, 'expected at least one fix op');
    expect(firstOp.op).toBe('note');
  });
});
