import { isRuleShape } from '../../../src/core/contracts/rule.ts';

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
    const validBindings = Object.create({ npm: validRule.bindings.npm });
    expect(isRuleShape({ ...validRule, bindings: validBindings })).toBe(false);
  });

  it('rejects a non-record bindings container', () => {
    expect(isRuleShape({ ...validRule, bindings: new Container() })).toBe(false);
  });

  it('rejects a non-record versionNote container', () => {
    expect(
      isRuleShape({
        ...validRule,
        bindings: { npm: { ...validRule.bindings.npm, versionNote: new Date() } },
      }),
    ).toBe(false);
  });

  it('accepts a complete rule including its binding functions', () => {
    expect(isRuleShape(validRule)).toBe(true);
  });

  it.each([
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
  ])('rejects invalid rule or binding discriminants: %j', (candidate) => {
    expect(isRuleShape(candidate)).toBe(false);
  });

  it('rejects a sparse projectTypes array', () => {
    const projectTypes = new Array(1);
    expect(isRuleShape({ ...validRule, projectTypes })).toBe(false);
  });
});
