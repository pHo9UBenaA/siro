import { expectTypeOf } from 'vitest';
import { getByPath, toParsedConfig } from '../../../src/domain/entities/config-value.ts';

describe(toParsedConfig, () => {
  it.each([Object.prototype, null])(
    'preserves values in a plain mapping with prototype %j',
    (prototype) => {
      expect.hasAssertions();
      const input = Object.assign(Object.create(prototype), { foo: 'bar', nested: { num: 1 } });
      expect(toParsedConfig(input)).toEqual({ foo: 'bar', nested: { num: 1 } });
    },
  );

  it.each([
    ['empty array', []],
    ['null', null],
    ['number', 42],
    ['Date', new Date('2024-01-01')],
  ])('rejects a non-mapping %s root', (_name, value) => {
    expect.hasAssertions();
    expect(() => toParsedConfig(value)).toThrow(/config root must be a mapping/iu);
  });
});

describe(getByPath, () => {
  it('preserves parser values and requires callers to narrow their types', () => {
    const date = new Date('2024-01-01');
    const config = toParsedConfig({ date, matrix: [[1, 2]], nested: { enabled: true } });

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
