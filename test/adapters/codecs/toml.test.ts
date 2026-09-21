import { getByPath } from '../../../src/domain/entities/config-value.ts';
import { tomlCodec } from '../../../src/adapters/codecs/toml.ts';

describe('tomlCodec.parse', () => {
  it('treats an empty document as an empty mapping', () => {
    expect.hasAssertions();
    expect(tomlCodec.parse('')).toStrictEqual({});
  });

  it('accepts a leading UTF-8 BOM before a normal commented table', () => {
    expect.hasAssertions();
    const config = tomlCodec.parse('\uFEFF# bun config\n[install]\nexact = true');
    expect(getByPath(config, ['install', 'exact'])).toBe(true);
  });
});
