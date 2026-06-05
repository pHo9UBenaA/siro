import { rules } from '../../src/domain/builtin-rules.ts';

vi.setConfig({ testTimeout: 5000 });

describe('builtin rules registry', () => {
  // The two id ↔ registry cross-checks (and duplicate-id check) are enforced
  // at compile time via `Record<BuiltinRuleId, Rule>` in builtin-rules.ts;
  // no runtime mirror is needed. This file only pins the invariant the type
  // system cannot express.
  it('every rule declares at least one PM binding', () => {
    expect.hasAssertions();
    for (const rule of rules) {
      const bindingCount = Object.values(rule.bindings).filter(
        (bd) => typeof bd !== 'undefined',
      ).length;
      const EMPTY = 0;
      expect(bindingCount, `${rule.id} has no bindings`).toBeGreaterThan(EMPTY);
    }
  });
});
