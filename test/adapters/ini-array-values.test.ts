import { getByPath } from '../../src/domain/entities/config-value.ts';
import { iniCodec } from '../../src/adapters/codecs/ini.ts';

vi.setConfig({ testTimeout: 5000 });

describe('iniCodec.parse array-valued keys', () => {
  it('preserves `key[]=` arrays instead of flattening them to {}', () => {
    expect.hasAssertions();
    const parsed = iniCodec.parse('noproxy[]=a\nnoproxy[]=b\n');
    expect(getByPath(parsed, ['noproxy'])).toStrictEqual(['a', 'b']);
  });

  it('coerces array elements like top-level scalars', () => {
    expect.hasAssertions();
    const parsed = iniCodec.parse('flags[]=true\nflags[]=7\n');
    const COERCED_NUMBER = 7;
    expect(getByPath(parsed, ['flags'])).toStrictEqual([true, COERCED_NUMBER]);
  });
});
