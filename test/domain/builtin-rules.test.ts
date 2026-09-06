import { type BuiltinRuleId, rules } from '../../src/domain/builtin-rules.ts';

describe('builtin rules registry', () => {
  it('derives a non-widened rule ID union from registry values', () => {
    expect.hasAssertions();
    const idUnionIsString: string extends BuiltinRuleId ? true : false = false;
    expect(idUnionIsString).toBe(false);
  });

  it('every rule declares at least one PM binding', () => {
    expect.hasAssertions();
    for (const rule of rules) {
      const bindingCount = Object.values(rule.bindings).filter(
        (bd) => typeof bd !== 'undefined',
      ).length;

      expect(bindingCount, `${rule.id} has no bindings`).toBeGreaterThan(0);
    }
  });
});
