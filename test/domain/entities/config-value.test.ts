import { toParsedConfig } from '../../../src/domain/entities/config-value.ts';

vi.setConfig({ testTimeout: 5000 });

const NESTED_NUM = 1;
const SAMPLE_A = 1;
const SAMPLE_B = 2;
const SAMPLE_C = 3;
const NON_OBJECT_NUMBER = 42;
const MAP_VALUE = 1;

describe(toParsedConfig, () => {
  it('returns the input untouched when it is a plain object', () => {
    expect.hasAssertions();
    const input = { foo: 'bar', nested: { num: NESTED_NUM } };
    expect(toParsedConfig(input)).toBe(input);
  });

  it('returns an empty object for arrays so codecs do not expose array-rooted configs', () => {
    expect.hasAssertions();
    expect(toParsedConfig([SAMPLE_A, SAMPLE_B, SAMPLE_C])).toStrictEqual({});
    expect(toParsedConfig([])).toStrictEqual({});
  });

  it('returns an empty object for null, undefined, and primitives', () => {
    expect.hasAssertions();
    expect(toParsedConfig(JSON.parse('null'))).toStrictEqual({});
    const [noArg]: unknown[] = [];
    expect(toParsedConfig(noArg)).toStrictEqual({});
    expect(toParsedConfig('a string')).toStrictEqual({});
    expect(toParsedConfig(NON_OBJECT_NUMBER)).toStrictEqual({});
    expect(toParsedConfig(true)).toStrictEqual({});
  });

  it('rejects Date, Map, Set at the root', () => {
    expect.hasAssertions();
    expect(toParsedConfig(new Date('2024-01-01'))).toStrictEqual({});
    expect(toParsedConfig(new Map([['a', MAP_VALUE]]))).toStrictEqual({});
    expect(toParsedConfig(new Set([SAMPLE_A, SAMPLE_B]))).toStrictEqual({});
  });

  it('accepts a null-prototype object created via Object.create(null)', () => {
    expect.hasAssertions();
    const input: Record<string, unknown> = Object.create(null);
    input.foo = 'bar';
    expect(toParsedConfig(input)).toBe(input);
  });
});
