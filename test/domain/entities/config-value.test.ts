import { getByPath, toParsedConfig } from '../../../src/domain/entities/config-value.ts';
import { expectTypeOf } from 'vitest';

describe(toParsedConfig, () => {
  it('returns the input untouched when it is a plain object', () => {
    expect.hasAssertions();
    const input = { foo: 'bar', nested: { num: 1 } };
    expect(toParsedConfig(input)).toBe(input);
  });

  it('rejects an array-rooted config', () => {
    expect.hasAssertions();
    expect(() => toParsedConfig([1, 2, 3])).toThrow(/config root must be a mapping/iu);
  });

  it.each([
    ['empty array', []],
    ['null', null],
    ['undefined', undefined],
    ['string', 'a string'],
    ['number', 42],
    ['boolean', true],
    ['Date', new Date('2024-01-01')],
    ['Map', new Map([['a', 1]])],
    ['Set', new Set([1, 2])],
  ])('rejects a non-mapping %s root', (_name, value) => {
    expect.hasAssertions();
    expect(() => toParsedConfig(value)).toThrow(/config root must be a mapping/iu);
  });

  it('accepts a null-prototype object created via Object.create(null)', () => {
    expect.hasAssertions();
    const input: Record<string, unknown> = Object.create(null);
    input.foo = 'bar';
    expect(toParsedConfig(input)).toBe(input);
  });
});

describe(getByPath, () => {
  it('preserves parser values and requires callers to narrow their types', () => {
    const date = new Date('2024-01-01');
    const config = toParsedConfig({ date, matrix: [[1, 2]], nested: { enabled: true } });

    expectTypeOf(config.date).toEqualTypeOf<unknown>();
    expectTypeOf(getByPath(config, ['date'])).toEqualTypeOf<unknown>();
    expect(getByPath(config, ['date'])).toBe(date);
    expect(getByPath(config, ['matrix'])).toStrictEqual([[1, 2]]);
    expect(getByPath(config, ['nested', 'enabled'])).toBe(true);
  });

  it('returns undefined for an inherited property', () => {
    expect.hasAssertions();
    expect(getByPath({}, ['constructor'])).toBeUndefined();
  });
});
