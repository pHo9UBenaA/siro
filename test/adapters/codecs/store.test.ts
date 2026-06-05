import type { CodecKind } from '../../../src/domain/entities/config-value.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';

vi.setConfig({ testTimeout: 5000 });

// Derived from a Record<CodecKind, _> so adding a CodecKind union member
// without listing it here is a compile error: the test cannot silently
// under-count when the union grows.
// Exhaustiveness guard: a new CodecKind union member that is not listed
// here will cause a compile error on the Record<CodecKind, true> type.
Object.freeze({
  json: true,
  npmrc: true,
  toml: true,
  yaml: true,
} satisfies Record<CodecKind, true>);

const ALL_KINDS: readonly CodecKind[] = ['json', 'npmrc', 'toml', 'yaml'];

describe(codecFor, () => {
  it('returns a codec for every declared CodecKind', () => {
    expect.hasAssertions();
    for (const kind of ALL_KINDS) {
      const codec = codecFor(kind);
      expect(codec).toBeDefined();
      expect(codec.parse).toBeTypeOf('function');
    }
  });

  it('returns the same codec instance for repeated lookups of the same kind', () => {
    expect.hasAssertions();
    // codecFor is a total function over a fixed table; repeated lookups must
    // be referentially stable so callers can cache the reference safely.
    expect(codecFor('json')).toBe(codecFor('json'));
    expect(codecFor('yaml')).toBe(codecFor('yaml'));
  });

  it('parses an empty document without throwing for every kind', () => {
    expect.hasAssertions();
    for (const kind of ALL_KINDS) {
      expect(() => codecFor(kind).parse('')).not.toThrow();
    }
  });
});
