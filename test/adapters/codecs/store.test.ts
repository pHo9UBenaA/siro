import { CODEC_KINDS } from '../../../src/domain/entities/config-value.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';

vi.setConfig({ testTimeout: 5000 });

describe(codecFor, () => {
  it('returns a codec for every declared CodecKind', () => {
    expect.hasAssertions();
    for (const kind of CODEC_KINDS) {
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
});
