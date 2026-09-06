import { applyConfig } from '../../../src/domain/services/apply-config.ts';
import { defineConfig } from '../../../src/domain/entities/siro-config.ts';
import { rules } from '../../../src/domain/builtin-rules.ts';

describe('applyConfig (registry)', () => {
  it('preserves the base rule order when no user config is provided', () => {
    expect.hasAssertions();
    const out = applyConfig(rules);
    expect(out.rules.map((rule) => rule.id)).toStrictEqual(rules.map((rule) => rule.id));
    expect(out.severityOverrides.size).toBe(0);
  });

  it("filters out rules disabled via 'off'", () => {
    expect.hasAssertions();
    const configured = applyConfig(rules, { rules: { provenance: 'off' } });
    expect(configured.rules.find((rule) => rule.id === 'provenance')).toBeUndefined();
    expect(configured.severityOverrides.has('provenance')).toBe(false);
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
    const configured = applyConfig(rules, custom);
    expect(configured.rules.map((rule) => rule.id)).toContain('custom-x');
  });
});
