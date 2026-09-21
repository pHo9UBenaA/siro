import { iniCodec } from '../../../src/adapters/codecs/ini.ts';

describe('iniCodec.parse', () => {
  it('treats an empty document as an empty mapping', () => {
    expect.hasAssertions();
    expect(iniCodec.parse('')).toStrictEqual({});
  });

  it('parses key=value pairs and coerces scalars', () => {
    expect.hasAssertions();
    const text = [
      '; comment',
      'flags[]=text',
      'flags[]=true',
      'flags[]=7',
      '# another comment',
      '',
      'ignore-scripts=true',
      'min-release-age=7',
      "save-prefix=''",
    ].join('\n');
    const config = iniCodec.parse(text);
    expect(config['ignore-scripts']).toBe(true);
    const MIN_RELEASE_AGE_DAYS = 7;
    expect(config['min-release-age']).toBe(MIN_RELEASE_AGE_DAYS);
    expect(config['save-prefix']).toBe('');
    expect(config.flags).toEqual(['text', true, 7]);
  });

  it('preserves null separately from empty strings, including in arrays', () => {
    const config = iniCodec.parse('value=null\nempty=\nquoted=""\nvalues[]=null\nvalues[]=\n');
    expect(config).toStrictEqual({ value: null, empty: '', quoted: '', values: [null, ''] });
  });
});
