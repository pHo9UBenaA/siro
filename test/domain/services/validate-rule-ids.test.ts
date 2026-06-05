import type { Rule } from '../../../src/domain/entities/rule.ts';
import type { SiroConfig } from '../../../src/domain/entities/siro-config.ts';
import { validateRuleIds } from '../../../src/domain/services/validate-rule-ids.ts';

vi.setConfig({ testTimeout: 5000 });

const builtin = (id: string): Rule => ({
  bindings: {},
  description: id,
  id,
  severity: 'warn',
  title: id,
});

const builtins = [builtin('a'), builtin('b'), builtin('c')];

describe('validateRuleIds — builtin collisions', () => {
  it('reports no duplicates or unknowns for an empty config', () => {
    expect.hasAssertions();
    const result = validateRuleIds({} satisfies SiroConfig, builtins);
    expect(result).toStrictEqual({ duplicates: [], unknown: [] });
  });

  it('reports a customRule id that collides with a builtin as a duplicate', () => {
    expect.hasAssertions();
    const config: SiroConfig = { customRules: [builtin('a')] };
    expect(validateRuleIds(config, builtins).duplicates).toStrictEqual(['a']);
  });
});

describe('validateRuleIds — intra-array collisions', () => {
  it('reports a customRule id that repeats within the same array as a duplicate', () => {
    expect.hasAssertions();
    const config: SiroConfig = { customRules: [builtin('x'), builtin('x')] };
    expect(validateRuleIds(config, builtins).duplicates).toStrictEqual(['x']);
  });

  it('reports each colliding id only once even when the same id repeats many times', () => {
    expect.hasAssertions();
    const config: SiroConfig = {
      customRules: [builtin('x'), builtin('x'), builtin('x'), builtin('x')],
    };
    const result = validateRuleIds(config, builtins);
    expect(result.duplicates).toStrictEqual(['x']);
  });
});

describe('validateRuleIds — unknown ids', () => {
  it('reports a `rules` key as unknown when it matches no builtin and no customRule', () => {
    expect.hasAssertions();
    const config: SiroConfig = { rules: { 'mistyped-id': 'warn' } };
    expect(validateRuleIds(config, builtins).unknown).toStrictEqual(['mistyped-id']);
  });

  it('accepts a `rules` key that targets a customRule id', () => {
    expect.hasAssertions();
    const config: SiroConfig = {
      customRules: [builtin('extra')],
      rules: { extra: 'off' },
    };
    expect(validateRuleIds(config, builtins).unknown).toStrictEqual([]);
  });

  it('flags a duplicate id before validating `rules` against the merged set', () => {
    expect.hasAssertions();
    const config: SiroConfig = {
      customRules: [builtin('a')],
      rules: Object.fromEntries([['a', 'off']]),
    };
    const result = validateRuleIds(config, builtins);
    expect(result.duplicates).toStrictEqual(['a']);
    expect(result.unknown).toStrictEqual([]);
  });
});

describe('validateRuleIds — ordering', () => {
  it('preserves first-occurrence order in both result arrays', () => {
    expect.hasAssertions();
    const config: SiroConfig = {
      customRules: [builtin('a'), builtin('b'), builtin('a')],
      rules: { yy: 'warn', zz: 'warn' },
    };
    const result = validateRuleIds(config, builtins);
    // `a` collides with a builtin; `b` does too; `a` appears again as an
    // intra-array repeat. Each colliding id is reported once, in the order
    // it first triggered a collision — `b` resolves before the second `a`
    // because the second `a` is a `seen.has` hit, not a fresh detection.
    expect(result.duplicates).toStrictEqual(['a', 'b']);
    expect(result.unknown).toStrictEqual(['yy', 'zz']);
  });
});
