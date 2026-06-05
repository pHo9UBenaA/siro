import { applyConfig } from '../../../src/domain/services/apply-config.ts';
import assert from 'node:assert';
import { defineConfig } from '../../../src/domain/entities/siro-config.ts';
import { rules } from '../../../src/domain/builtin-rules.ts';

vi.setConfig({ testTimeout: 5000 });

describe('applyConfig (registry)', () => {
  it('returns a copy of the base ruleset when no user config is provided', () => {
    expect.hasAssertions();
    const out = applyConfig(rules);
    expect(out).toStrictEqual([...rules]);
    expect(out).not.toBe(rules);
  });

  it("filters out rules disabled via 'off'", () => {
    expect.hasAssertions();
    const filtered = applyConfig(rules, { rules: { provenance: 'off' } });
    expect(filtered.find((rule) => rule.id === 'provenance')).toBeUndefined();
  });

  it('overrides severities for the rules that opt in', () => {
    expect.hasAssertions();
    const filtered = applyConfig(rules, { rules: { 'pin-exact-versions': 'warn' } });
    const pinRule = filtered.find((rule) => rule.id === 'pin-exact-versions');
    assert(pinRule, 'expected pin-exact-versions rule');
    expect(pinRule.severity).toBe('warn');
  });

  it('appends customRules to the active ruleset', () => {
    expect.hasAssertions();
    const custom = defineConfig({
      customRules: [
        {
          bindings: {},
          description: '',
          id: 'custom-x',
          severity: 'info',
          title: 'X',
        },
      ],
    });
    const filtered = applyConfig(rules, custom);
    expect(filtered.map((rule) => rule.id)).toContain('custom-x');
  });
});
