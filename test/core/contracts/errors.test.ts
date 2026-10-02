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
    const original = new ConfigError('inner.toml: original');
    let caught: unknown;
    try {
      wrapCodecError('outer.toml', () => {
        throw original;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(original);
  });
});
