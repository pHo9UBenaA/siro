import { isRuleShape } from '../../../src/domain/entities/rule.ts';

vi.setConfig({ testTimeout: 5000 });

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
});
