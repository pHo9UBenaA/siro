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
])('matches native JSON and preserves decoded data: %j', (value) => {
  const native = safeJsonText(JSON.stringify(value, undefined, 2));
  const size = Buffer.byteLength(native) + 1;
  expect(boundedJson(value, size, 128)).toBe(native);
  expect(() => boundedJson(value, size - 1, 128)).toThrow(/maxOutputBytes/);
});

it('bounds expansion of shared values and rejects cycles/deep reports', () => {
  const shared = { text: 'a'.repeat(100) };
  expect(() =>
    boundedJson(
      Array.from({ length: 1000 }, () => shared),
      1024,
      128,
    ),
  ).toThrow(/maxOutputBytes/);
  const cycle: { next?: unknown } = {};
  cycle.next = cycle;
  expect(() => boundedJson(cycle, 1024, 128)).toThrow(/circular/);
  expect(() => boundedJson({ a: { b: {} } }, 1024, 2)).toThrow(/nesting/);
});
