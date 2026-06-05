import { yamlCodec } from '../../../src/adapters/codecs/yaml.ts';

vi.setConfig({ testTimeout: 5000 });

const MINIMUM_RELEASE_AGE_MINUTES = 1440;

describe('yamlCodec.parse (shallow)', () => {
  it('parses top-level scalars and coerces them', () => {
    expect.hasAssertions();
    const text = ['minimumReleaseAge: 1440', "savePrefix: ''", 'strictDepBuilds: true'].join('\n');
    const config = yamlCodec.parse(text);
    expect(config.minimumReleaseAge).toBe(MINIMUM_RELEASE_AGE_MINUTES);
    expect(config.savePrefix).toBe('');
    expect(config.strictDepBuilds).toBe(true);
  });

  it('rejects an alias bomb instead of expanding it unbounded', () => {
    expect.hasAssertions();
    // A `pnpm-workspace.yaml` on a fork PR can be attacker-controlled. The
    // codec must keep the library's billion-laughs guard (maxAliasCount) so a
    // few KB of nested anchors can't blow up into an OOM during a CI lint.
    const refs = Array.from({ length: 200 }, (_unused, idx) => `k${idx}: *a`).join('\n');
    expect(() => yamlCodec.parse(`base: &a value\n${refs}`)).toThrow(/excessive alias count/iu);
  });

  it('still parses an ordinary document with a few aliases', () => {
    expect.hasAssertions();
    const text = ['base: &a value', 'one: *a', 'two: *a'].join('\n');
    expect(() => yamlCodec.parse(text)).not.toThrow();
  });

  it('ignores comments and does not descend into nested blocks', () => {
    expect.hasAssertions();
    const text = [
      '# pnpm settings',
      'minimumReleaseAge: 1440',
      'trustPolicyExclude:',
      '  - chokidar@4.0.3',
    ].join('\n');
    const config = yamlCodec.parse(text);
    expect(config.minimumReleaseAge).toBe(MINIMUM_RELEASE_AGE_MINUTES);
    expect(config['- chokidar@4.0.3']).toBeUndefined();
  });
});
