import { iniCodec } from '../../../src/adapters/codecs/ini.ts';

vi.setConfig({ testTimeout: 5000 });

describe('iniCodec.parse', () => {
  it('parses key=value pairs and coerces scalars', () => {
    expect.hasAssertions();
    const text = ['ignore-scripts=true', 'min-release-age=7', "save-prefix=''"].join('\n');
    const config = iniCodec.parse(text);
    expect(config['ignore-scripts']).toBe(true);
    const MIN_RELEASE_AGE_DAYS = 7;
    expect(config['min-release-age']).toBe(MIN_RELEASE_AGE_DAYS);
    expect(config['save-prefix']).toBe('');
  });

  it('ignores comment lines (; and #) and blank lines', () => {
    expect.hasAssertions();
    const text = ['; this is a comment', '# another comment', '', 'save-exact=true'].join('\n');
    const config = iniCodec.parse(text);
    expect(Object.keys(config)).toStrictEqual(['save-exact']);
    expect(config['save-exact']).toBe(true);
  });
});
