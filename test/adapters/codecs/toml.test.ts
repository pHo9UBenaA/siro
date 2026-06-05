import { getByPath } from '../../../src/domain/entities/config-value.ts';
import { tomlCodec } from '../../../src/adapters/codecs/toml.ts';

vi.setConfig({ testTimeout: 5000 });

describe('tomlCodec.parse', () => {
  it('parses tables into nested objects and coerces scalars', () => {
    expect.hasAssertions();
    const text = [
      '[install]',
      'exact = true',
      'minimumReleaseAge = 259200',
      '',
      '[install.security]',
      'scanner = "@acme/scanner"',
    ].join('\n');
    const config = tomlCodec.parse(text);
    expect(getByPath(config, ['install', 'exact'])).toBe(true);
    const MINIMUM_RELEASE_AGE_SECONDS = 259_200;
    expect(getByPath(config, ['install', 'minimumReleaseAge'])).toBe(MINIMUM_RELEASE_AGE_SECONDS);
    expect(getByPath(config, ['install', 'security', 'scanner'])).toBe('@acme/scanner');
  });

  it('ignores comments', () => {
    expect.hasAssertions();
    const config = tomlCodec.parse('# bun config\n[install]\nexact = true');
    expect(getByPath(config, ['install', 'exact'])).toBe(true);
  });
});
