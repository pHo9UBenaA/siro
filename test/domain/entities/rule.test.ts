import { isRuleShape } from '../../../src/domain/entities/rule.ts';

class Container {
  public readonly marker = true;
}

const validRule = {
  bindings: {
    npm: {
      check: () => ({ state: 'ok' }),
      file: { kind: 'npmrc', path: '.npmrc' },

      versionNote: { note: 'display only' },
    },
  },
  description: 'description',
  id: 'demo',
  projectTypes: ['package'],
  severity: 'warn',
  title: 'Demo',
};

describe(isRuleShape, () => {
  it('rejects inherited binding maps even when their entries are valid', () => {
    expect.hasAssertions();
    const validBindings = Object.create({ npm: validRule.bindings.npm });
    expect(isRuleShape({ ...validRule, bindings: validBindings })).toBe(false);
  });

  it('rejects a non-record bindings container', () => {
    expect.hasAssertions();
    expect(isRuleShape({ ...validRule, bindings: new Container() })).toBe(false);
  });

  it('rejects a non-record versionNote container', () => {
    expect.hasAssertions();
    expect(
      isRuleShape({
        ...validRule,
        bindings: { npm: { ...validRule.bindings.npm, versionNote: new Date() } },
      }),
    ).toBe(false);
  });

  it('accepts a complete rule including its binding functions', () => {
    expect.hasAssertions();
    expect(isRuleShape(validRule)).toBe(true);
  });

  it('rejects invalid rule and binding discriminants', () => {
    expect.hasAssertions();
    const candidates = [
      { ...validRule, severity: 'fatal' },
      { ...validRule, projectTypes: ['service'] },
      { ...validRule, bindings: { cargo: validRule.bindings.npm } },
      {
        ...validRule,
        bindings: {
          npm: { ...validRule.bindings.npm, file: { kind: 'xml', path: '.npmrc' } },
        },
      },
      {
        ...validRule,
        bindings: { npm: { ...validRule.bindings.npm, check: 'not-a-function' } },
      },
      {
        ...validRule,
        bindings: { npm: { ...validRule.bindings.npm, versionNote: { note: 42 } } },
      },
    ];
    expect(candidates.map((candidate) => isRuleShape(candidate))).toStrictEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('rejects a sparse projectTypes array', () => {
    expect.hasAssertions();
    const projectTypes = new Array(1);
    expect(isRuleShape({ ...validRule, projectTypes })).toBe(false);
  });
});
