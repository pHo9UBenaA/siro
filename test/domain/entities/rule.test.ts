import { isRuleShape } from '../../../src/domain/entities/rule.ts';

vi.setConfig({ testTimeout: 5000 });

const SPARSE_ARRAY_LENGTH = 1;

class Container {
  public readonly marker = true;
}

const NON_RECORD_OBJECTS = [new Date(), new Map(), new Set(), /x/u, new Container()];

const validRule = {
  bindings: {
    npm: {
      check: () => ({ state: 'ok' }),
      file: { kind: 'npmrc', path: '.npmrc' },
      fix: () => [],
      fixKind: 'auto',
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
    const invalidBindings = Object.create({ npm: { check: 'not-a-function' } });
    const validBindings = Object.create({ npm: validRule.bindings.npm });
    expect(isRuleShape({ ...validRule, bindings: invalidBindings })).toBe(false);
    expect(isRuleShape({ ...validRule, bindings: validBindings })).toBe(false);
  });

  it.each(NON_RECORD_OBJECTS)('rejects a %s bindings container', (bindings) => {
    expect.hasAssertions();
    expect(isRuleShape({ ...validRule, bindings })).toBe(false);
  });

  it.each(NON_RECORD_OBJECTS)('rejects a %s versionNote container', (versionNote) => {
    expect.hasAssertions();
    expect(
      isRuleShape({
        ...validRule,
        bindings: { npm: { ...validRule.bindings.npm, versionNote } },
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
    const projectTypes = new Array(SPARSE_ARRAY_LENGTH);
    expect(isRuleShape({ ...validRule, projectTypes })).toBe(false);
  });
});
