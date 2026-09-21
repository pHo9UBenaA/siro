import assert from 'node:assert';
import { auditSuppression } from '../../../src/domain/rules/audit-suppression.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const { yarn } = auditSuppression.bindings;
assert(yarn, 'expected yarn binding');
const yarnBinding = yarn;

describe('audit-suppression: check states', () => {
  it('ok when neither key is present', () => {
    expect.hasAssertions();
    expect(yarnBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when both suppression lists are empty', () => {
    expect.hasAssertions();
    expect(
      yarnBinding.check(makeCtx(), { npmAuditIgnoreAdvisories: [], npmAuditExcludePackages: [] })
        .state,
    ).toBe('ok');
  });

  it('violation when npmAuditIgnoreAdvisories has entries', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), { npmAuditIgnoreAdvisories: ['1234567'] });
    assert(status.state === 'violation');
    expect(status.message).toContain('npmAuditIgnoreAdvisories');
  });

  it('violation when npmAuditExcludePackages has entries', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), { npmAuditExcludePackages: ['lodash'] });
    assert(status.state === 'violation');
    expect(status.message).toContain('npmAuditExcludePackages');
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

    expect(Object.keys(auditSuppression.bindings).sort()).toEqual(['yarn']);

    expect(auditSuppression.severity).toBe('info');
    expect(yarnBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
  });
});
