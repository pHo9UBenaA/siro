import { ConfigError } from '../../../src/shared/errors.ts';
import type { Rule } from '../../../src/domain/entities/rule.ts';
import assert from 'node:assert';
import { mergeProgrammaticRules } from '../../../src/domain/services/merge-programmatic-rules.ts';

vi.setConfig({ testTimeout: 5000 });

const SINGLE_OCCURRENCE = 1;

const rule = (id: string): Rule =>
  // Freeze so an accidental in-test mutation (e.g. `r.severity = 'error'`)
  // throws on the spot instead of contaminating the next test through the
  // module-scoped `builtins` reference below.
  Object.freeze({
    bindings: {},
    description: `stub ${id}`,
    id,
    severity: 'warn',
    title: id,
  });

const builtins: readonly Rule[] = Object.freeze([rule('builtin-a'), rule('builtin-b')]);

const captureThrow = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected fn to throw');
};

describe('mergeProgrammaticRules — no-op cases', () => {
  it('returns the builtins untouched when no programmatic rules are supplied', () => {
    expect.hasAssertions();
    const merged = mergeProgrammaticRules(builtins);
    expect(merged).toBe(builtins);
  });

  it('returns the builtins untouched when programmatic is an empty list', () => {
    expect.hasAssertions();
    const merged = mergeProgrammaticRules(builtins, []);
    expect(merged).toBe(builtins);
  });

  it('appends programmatic rules after the builtins', () => {
    expect.hasAssertions();
    const extra = [rule('custom-x'), rule('custom-y')];
    const merged = mergeProgrammaticRules(builtins, extra);
    expect(merged.map((mr) => mr.id)).toStrictEqual([
      'builtin-a',
      'builtin-b',
      'custom-x',
      'custom-y',
    ]);
  });
});

describe('mergeProgrammaticRules — cross-source collisions', () => {
  it('rejects a programmatic id that collides with a builtin', () => {
    expect.hasAssertions();
    expect(() => mergeProgrammaticRules(builtins, [rule('builtin-a')])).toThrow(ConfigError);
  });

  it('rejects a programmatic id that collides with a config-supplied customRule', () => {
    expect.hasAssertions();
    expect(() => mergeProgrammaticRules(builtins, [rule('config-z')], [rule('config-z')])).toThrow(
      /'config-z'/u,
    );
  });
});

describe('mergeProgrammaticRules — intra-array collisions', () => {
  it('reports a single duplicate id once even when it appears multiple times', () => {
    expect.hasAssertions();
    const err = captureThrow(() =>
      mergeProgrammaticRules(builtins, [rule('dup'), rule('dup'), rule('dup')]),
    );
    expect(err).toBeInstanceOf(ConfigError);
    assert(err instanceof Error, 'expected an Error');
    const occurrences = err.message.split("'dup'").length - SINGLE_OCCURRENCE;
    expect(occurrences).toBe(SINGLE_OCCURRENCE);
  });

  it('catches an intra-array duplicate where neither id is in builtins or configCustom', () => {
    expect.hasAssertions();
    expect(() =>
      mergeProgrammaticRules(builtins, [rule('unique-dup'), rule('unique-dup')]),
    ).toThrow(/'unique-dup'/u);
  });
});

describe('mergeProgrammaticRules — error messages', () => {
  it('pluralises the collision message when more than one id collides', () => {
    expect.hasAssertions();
    expect(() => mergeProgrammaticRules(builtins, [rule('builtin-a'), rule('builtin-b')])).toThrow(
      /rule ids collide/u,
    );
  });

  it('uses the singular noun and verb when exactly one id collides', () => {
    expect.hasAssertions();
    expect(() => mergeProgrammaticRules(builtins, [rule('builtin-a')])).toThrow(
      /rule id collides/u,
    );
  });
});
