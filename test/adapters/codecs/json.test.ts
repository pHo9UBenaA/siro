import { ConfigParseError } from '../../../src/core/contracts/errors.ts';
import { jsonCodec } from '../../../src/adapters/codecs/json.ts';

describe('jsonCodec.parse', () => {
  it('rejects an empty JSON document', () => {
    expect(() => jsonCodec.parse('')).toThrow(ConfigParseError);
  });

  it('rejects a non-mapping root', () => {
    expect(() => jsonCodec.parse('[]')).toThrow(/config root must be a mapping/iu);
  });
});
