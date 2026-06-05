import { ConfigError } from '../../src/shared/errors.ts';
import type { Rule } from '../../src/domain/entities/rule.ts';
import type { SiroConfig } from '../../src/domain/entities/siro-config.ts';
import { assertConfigRuleIdsKnown } from '../../src/application/validate-config-rules.ts';

vi.setConfig({ testTimeout: 5000 });

const MISSING: undefined = JSON.parse('{}')._;

const rule = (id: string): Rule => ({
  bindings: {},
  description: id,
  id,
  severity: 'warn',
  title: id,
});

const extractConfigError = (fn: () => void): ConfigError => {
  try {
    fn();
  } catch (error: unknown) {
    if (error instanceof ConfigError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected ConfigError to be thrown');
};

const assertDoesNotThrow = (fn: () => void): void => {
  expect(fn).not.toThrow();
};

describe('assertConfigRuleIdsKnown — no-op cases', () => {
  it('does nothing when the user config is undefined', () => {
    expect.hasAssertions();
    assertDoesNotThrow(() => {
      assertConfigRuleIdsKnown(MISSING, []);
    });
  });

  it('does nothing when `rules` only names builtins', () => {
    expect.hasAssertions();
    const config: SiroConfig = { rules: { 'frozen-lockfile': 'warn' } };
    assertDoesNotThrow(() => {
      assertConfigRuleIdsKnown(config);
    });
  });

  it('accepts a `rules` entry whose id is supplied by a programmatic rule', () => {
    expect.hasAssertions();
    const config: SiroConfig = { rules: { 'org-rule': 'error' } };
    assertDoesNotThrow(() => {
      assertConfigRuleIdsKnown(config, [rule('org-rule')]);
    });
  });

  it('accepts a `rules` entry whose id is supplied by a config customRule', () => {
    expect.hasAssertions();
    const config: SiroConfig = {
      customRules: [rule('config-side-rule')],
      rules: { 'config-side-rule': 'off' },
    };
    assertDoesNotThrow(() => {
      assertConfigRuleIdsKnown(config);
    });
  });
});

describe('assertConfigRuleIdsKnown — error cases', () => {
  it('throws ConfigError when a `rules` entry names no known rule', () => {
    expect.hasAssertions();
    const config: SiroConfig = { rules: { 'typo-rule': 'warn' } };
    expect(() => {
      assertConfigRuleIdsKnown(config);
    }).toThrow(ConfigError);
  });

  it('pluralises and lists every unknown id once', () => {
    expect.hasAssertions();
    const config: SiroConfig = {
      rules: { 'typo-one': 'warn', 'typo-two': 'error' },
    };
    const err = extractConfigError(() => {
      assertConfigRuleIdsKnown(config);
    });
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.message).toMatch(/unknown rule ids/u);
    expect(err.message).toContain("'typo-one'");
    expect(err.message).toContain("'typo-two'");
  });

  it('filters out known ids from the error message', () => {
    expect.hasAssertions();
    const config: SiroConfig = {
      rules: { provenance: 'off', 'typo-rule': 'warn' },
    };
    const err = extractConfigError(() => {
      assertConfigRuleIdsKnown(config);
    });
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.message).toContain("'typo-rule'");
    expect(err.message).not.toContain("'provenance'");
  });
});
