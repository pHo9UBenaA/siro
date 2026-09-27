import { bunSecurityScanner } from '../../../src/core/rules/bun-security-scanner.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const { bun } = bunSecurityScanner.bindings;
if (!bun) {
  throw new TypeError('expected bun binding');
}
const bunBinding = bun;

describe('bun-security-scanner', () => {
  it('flags a violation when [install.security] scanner is unset', () => {
    expect.hasAssertions();
    expect(bunBinding.check(makeCtx(), {}).state).toBe('violation');
  });

  it('passes when a non-empty scanner name is configured', () => {
    expect.hasAssertions();
    expect(
      bunBinding.check(makeCtx(), {
        install: { security: { scanner: '@socketsecurity/bun-security-scanner' } },
      }).state,
    ).toBe('ok');
  });
});
