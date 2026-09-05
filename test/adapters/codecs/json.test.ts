import { getByPath } from '../../../src/domain/entities/config-value.ts';
import { jsonCodec } from '../../../src/adapters/codecs/json.ts';

vi.setConfig({ testTimeout: 5000 });

describe('jsonCodec.parse', () => {
  it('parses JSON into a nested object', () => {
    expect.hasAssertions();
    const config = jsonCodec.parse('{ "lock": { "frozen": true } }');
    expect(getByPath(config, ['lock', 'frozen'])).toBe(true);
  });

  it('rejects an empty JSON document', () => {
    expect.hasAssertions();
    expect(() => jsonCodec.parse('')).toThrow(/./u);
  });

  it.each(['[]', 'null', 'true', '"text"', '42'])('rejects a non-mapping root: %s', (text) => {
    expect.hasAssertions();
    expect(() => jsonCodec.parse(text)).toThrow(/config root must be a mapping/iu);
  });
});
