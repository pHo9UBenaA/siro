import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { auditSuppression } from '../../../src/domain/rules/audit-suppression.ts';

vi.setConfig({ testTimeout: 5000 });

const { yarn } = auditSuppression.bindings;
assert(yarn, 'expected yarn binding');
const yarnBinding = yarn;

describe('audit-suppression: check states', () => {
  it('ok when neither key is present', () => {
    expect.hasAssertions();
    expect(yarnBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when npmAuditIgnoreAdvisories is an empty array', () => {
    expect.hasAssertions();
    expect(yarnBinding.check(makeCtx(), { npmAuditIgnoreAdvisories: [] }).state).toBe('ok');
  });

  it('ok when npmAuditExcludePackages is an empty array', () => {
    expect.hasAssertions();
    expect(yarnBinding.check(makeCtx(), { npmAuditExcludePackages: [] }).state).toBe('ok');
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

  it('violation names both keys when both are present', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), {
      npmAuditExcludePackages: ['lodash'],
      npmAuditIgnoreAdvisories: ['1234567'],
    });
    assert(status.state === 'violation');
    expect(status.message).toContain('npmAuditIgnoreAdvisories');
    expect(status.message).toContain('npmAuditExcludePackages');
  });
});

describe('audit-suppression: scope, metadata, and fix', () => {
  it('only binds to yarn', () => {
    expect.hasAssertions();
    expect(auditSuppression.bindings.npm).toBeUndefined();
    expect(auditSuppression.bindings.pnpm).toBeUndefined();
    expect(auditSuppression.bindings.bun).toBeUndefined();
    expect(auditSuppression.bindings.deno).toBeUndefined();
    expect(auditSuppression.bindings.aube).toBeUndefined();
    expect(auditSuppression.bindings.yarn).toBeDefined();
  });

  it('ships at info severity and targets .yarnrc.yml', () => {
    expect.hasAssertions();
    expect(auditSuppression.severity).toBe('info');
    expect(yarnBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
  });

  it('is an advisory binding', () => {
    expect.hasAssertions();
    expect(yarnBinding.fixKind).toBe('advisory');
  });

  it('fix returns a note op', () => {
    expect.hasAssertions();
    const ops = yarnBinding.fix(makeCtx());
    const SINGLE = 1;
    expect(ops).toHaveLength(SINGLE);
    expect(ops[0]).toMatchObject({ op: 'note' });
  });
});
