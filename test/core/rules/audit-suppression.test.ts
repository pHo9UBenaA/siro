import { bindingForTest } from '../../helpers/rules.ts';
import assert from 'node:assert';
import { auditSuppression } from '../../../src/core/rules/audit-suppression.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const yarnBinding = bindingForTest(auditSuppression, 'yarn');

describe('audit-suppression: check states', () => {
  it('ok when neither key is present', () => {
    expect(yarnBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when both suppression lists are empty', () => {
    expect(
      yarnBinding.check(makeCtx(), { npmAuditIgnoreAdvisories: [], npmAuditExcludePackages: [] })
        .state,
    ).toBe('ok');
  });

  it('reports both suppression lists for manual review', () => {
    const status = yarnBinding.check(makeCtx(), {
      npmAuditExcludePackages: ['lodash'],
      npmAuditIgnoreAdvisories: ['1234567'],
    });
    assert(status.state === 'violation');
    expect(status.message).toContain('npmAuditIgnoreAdvisories');
    expect(status.message).toContain('npmAuditExcludePackages');

    expect(status.remediation).toMatchObject({ kind: 'manual', steps: expect.any(Array) });
  });
});
