import { getByPath } from '../../../src/domain/entities/config-value.ts';
import { jsonCodec } from '../../../src/adapters/codecs/json.ts';

vi.setConfig({ testTimeout: 5000 });

describe('jsonCodec.parse', () => {
  it('parses JSON into a nested object', () => {
    expect.hasAssertions();
    const config = jsonCodec.parse('{ "lock": { "frozen": true } }');
    expect(getByPath(config, ['lock', 'frozen'])).toBe(true);
  });

  it('treats empty input as an empty object', () => {
    expect.hasAssertions();
    expect(jsonCodec.parse('')).toStrictEqual({});
  });
});
