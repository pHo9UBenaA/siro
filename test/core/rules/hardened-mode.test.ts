import { hardenedMode } from '../../../src/core/rules/hardened-mode.ts';
import { makePublishableCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';
import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';

describe('hardened-mode (yarn)', () => {
  it('requires and proposes enableHardenedMode on Yarn', () => {
    const ruleBinding = bindingForTest(hardenedMode, 'yarn');

    expect(hardenedMode.severity).toBe('warn');
    expect(Object.keys(hardenedMode.bindings)).toStrictEqual(['yarn']);
    expect(ruleBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
    const missing = ruleBinding.check(makePublishableCtx(), {});
    expect(ruleBinding.check(makePublishableCtx(), { enableHardenedMode: true }).state).toBe('ok');
    const explicitFalse = ruleBinding.check(makePublishableCtx(), { enableHardenedMode: false });
    assertCheckState(explicitFalse, 'violation');
    expect(explicitFalse.severity).toBeUndefined();

    const setKey = automaticOperations(missing)[0];
    expect(setKey).toMatchObject({ keyPath: ['enableHardenedMode'], value: true });
  });
});
