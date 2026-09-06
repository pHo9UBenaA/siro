import { bunSecurityScanner } from '../../../src/domain/rules/bun-security-scanner.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const { bun } = bunSecurityScanner.bindings;
if (!bun) {
  throw new TypeError('expected bun binding');
}
const bunBinding = bun;

describe('bun-security-scanner', () => {
  it('is info-severity, targets bunfig.toml', () => {
    expect.hasAssertions();
    expect(bunSecurityScanner.severity).toBe('info');
    expect(bunBinding.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
  });

  it('flags a violation when [install.security] scanner is unset', () => {
    expect.hasAssertions();
    expect(bunBinding.check(makeCtx(), {}).state).toBe('violation');
  });

  it('records which bun version first shipped the scanner setting', () => {
    expect.hasAssertions();
    expect(bunBinding.versionNote).toStrictEqual({ configAvailableSince: 'bun 1.3.0' });
  });

  it('passes when a non-empty scanner name is configured', () => {
    expect.hasAssertions();
    expect(
      bunBinding.check(makeCtx(), {
        install: { security: { scanner: '@socketsecurity/bun-security-scanner' } },
      }).state,
    ).toBe('ok');
  });

  it('is N/A for non-bun PMs (no binding registered)', () => {
    expect.hasAssertions();
    expect(bunSecurityScanner.bindings.npm).toBeUndefined();
    expect(bunSecurityScanner.bindings.deno).toBeUndefined();
  });
});
