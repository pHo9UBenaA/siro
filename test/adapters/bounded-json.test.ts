import { runInNewContext } from 'node:vm';
import { boundedJson } from '../../src/adapters/reporters/bounded-json.ts';
import { safeJsonText } from '../../src/adapters/safe-text.ts';

it.each([
  { empty: {}, array: [], missing: undefined },
  {
    values: [true, false, null, NaN, Infinity, 0, -0, 1.5, 'é😀\u0000##[error]\u202e'],
    nested: { x: 1 },
  },
  { date: new Date('2020-01-01T00:00:00Z'), array: [undefined, () => {}, Symbol('ignored')] },
  {
    custom: {
      toJSON(key: string) {
        return { key, value: 42 };
      },
    },
  },
  { boxed: [new Number(1), new String('x'), new Boolean(false)] },
  { boxed: runInNewContext('[new Number(1), new String("x"), new Boolean(false)]') },
  { custom: { toJSON: () => new Number(7) } },
  {
    boxed: [
      Object.assign(new Number(1), { valueOf: () => 'not numeric' }),
      Object.assign(new String('x'), { valueOf: () => 'wrong' }),
      Object.assign(new Boolean(false), { valueOf: () => true }),
    ],
  },
  { callable: Object.assign(() => {}, { toJSON: (key: string) => key }) },
])('matches native JSON and preserves decoded data: %j', (value) => {
  const native = safeJsonText(JSON.stringify(value, undefined, 2));
  const size = Buffer.byteLength(native) + 1;
  expect(boundedJson(value, size, 128)).toBe(native);
  expect(() => boundedJson(value, size - 1, 128)).toThrow(/maxOutputBytes/);
});

it.each([Object(1n), runInNewContext('Object(1n)')])(
  'rejects boxed BigInt instead of silently emitting an empty object',
  (value) => {
    expect(() => JSON.stringify(value)).toThrow(TypeError);
    expect(() => boundedJson({ actual: value }, 1024, 128)).toThrow(TypeError);
  },
);

it('reads toJSON once and does not invoke the returned object hook again', () => {
  let reads = 0;
  const value = {
    get toJSON() {
      reads++;
      return () => ({ toJSON: () => 'must not run', value: 7 });
    },
  };
  expect(boundedJson(value, 1024, 128)).toBe('{\n  "value": 7\n}');
  expect(reads).toBe(1);
});

it('snapshots array length before child toJSON hooks change it', () => {
  const input = () => {
    const array: unknown[] = [];
    array.push({
      toJSON() {
        array.push('late');
        return 'first';
      },
    });
    return array;
  };
  expect(boundedJson(input(), 1024, 128)).toBe(JSON.stringify(input(), undefined, 2));
});

it('bounds expansion of shared values', () => {
  const shared = { text: 'a'.repeat(100) };
  expect(() =>
    boundedJson(
      Array.from({ length: 1000 }, () => shared),
      1024,
      128,
    ),
  ).toThrow(/maxOutputBytes/);
});

it('rejects circular reports', () => {
  const cycle: { next?: unknown } = {};
  cycle.next = cycle;
  expect(() => boundedJson(cycle, 1024, 128)).toThrow(/circular/);
});

it('rejects reports deeper than the configured limit', () => {
  expect(() => boundedJson({ a: { b: {} } }, 1024, 2)).toThrow(/nesting/);
});
