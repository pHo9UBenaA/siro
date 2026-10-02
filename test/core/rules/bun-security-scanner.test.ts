import { bindingForTest } from '../../helpers/rules.ts';
import { bunSecurityScanner } from '../../../src/core/rules/bun-security-scanner.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const bunBinding = bindingForTest(bunSecurityScanner, 'bun');

describe('bun-security-scanner', () => {
  it('flags a violation when [install.security] scanner is unset', () => {
    expect(bunBinding.check(makeCtx(), {}).state).toBe('violation');
  });

  it('passes when a non-empty scanner name is configured', () => {
    expect(
      bunBinding.check(makeCtx(), {
        install: { security: { scanner: '@socketsecurity/bun-security-scanner' } },
      }).state,
    ).toBe('ok');
  });
});

describe('Malformed settings', () => {
  const ctx = makeCtx();
  it('does not treat whitespace as a configured Bun scanner', () => {
    expect(
      bunSecurityScanner.bindings.bun?.check(ctx, { install: { security: { scanner: '  ' } } })
        .state,
    ).toBe('violation');
  });
});
