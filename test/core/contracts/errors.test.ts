import { ConfigError, wrapCodecError } from '../../../src/core/contracts/errors.ts';

/** Throws a non-Error value to exercise code paths handling bare throws. */
const throwValue = (value: unknown): never => {
  throw value;
};

describe(wrapCodecError, () => {
  it('does not disclose an unknown parser exception in the prefixed message', () => {
    expect(() => wrapCodecError('x.json', () => throwValue('literal'))).toThrow(
      new ConfigError('x.json: Invalid configuration.'),
    );
  });

  it('re-throws an existing ConfigError unchanged so a nested wrap does not double-prefix', () => {
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
