import { ConfigError, wrapCodecError } from '../../src/shared/errors.ts';

vi.setConfig({ testTimeout: 5000 });

/** Throws a non-Error value to exercise code paths handling bare throws. */
const throwValue = (value: unknown): never => {
  throw value;
};

describe(wrapCodecError, () => {
  it('returns the value when fn succeeds without throwing', () => {
    expect.hasAssertions();
    const EXPECTED_VALUE = 42;
    expect(wrapCodecError('foo.toml', () => EXPECTED_VALUE)).toBe(EXPECTED_VALUE);
  });

  it('wraps a bare Error as a ConfigError prefixed with the file path', () => {
    expect.hasAssertions();
    expect(() =>
      wrapCodecError('bunfig.toml', () => {
        throw new Error('unterminated string');
      }),
    ).toThrow(new ConfigError('bunfig.toml: unterminated string'));
  });

  it('coerces a non-Error thrown value through String() into the prefixed message', () => {
    expect.hasAssertions();
    expect(() => wrapCodecError('x.json', () => throwValue('literal'))).toThrow(
      new ConfigError('x.json: literal'),
    );
  });

  it('re-throws an existing ConfigError unchanged so a nested wrap does not double-prefix', () => {
    expect.hasAssertions();
    // Without the instanceof guard, a ConfigError already framed as
    // `inner.toml: ...` would be re-wrapped into `outer.toml: inner.toml: ...`
    // by every layer that calls wrapCodecError, garbling the path prefix.
    const original = new ConfigError('inner.toml: original');
    expect(() =>
      wrapCodecError('outer.toml', () => {
        throw original;
      }),
    ).toThrow(original);
  });
});
