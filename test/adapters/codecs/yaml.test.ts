import { yamlCodec } from '../../../src/adapters/codecs/yaml.ts';

const MINIMUM_RELEASE_AGE_MINUTES = 1440;

describe('yamlCodec.parse', () => {
  it('treats an empty or comment-only YAML document as an empty mapping', () => {
    expect.hasAssertions();
    expect(yamlCodec.parse('   \n')).toStrictEqual({});
    expect(yamlCodec.parse('# workspace boundary\n')).toStrictEqual({});
  });

  it('parses top-level scalars and coerces them', () => {
    expect.hasAssertions();
    const text = ['minimumReleaseAge: 1440', "savePrefix: ''", 'strictDepBuilds: true'].join('\n');
    const config = yamlCodec.parse(text);
    expect(config.minimumReleaseAge).toBe(MINIMUM_RELEASE_AGE_MINUTES);
    expect(config.savePrefix).toBe('');
    expect(config.strictDepBuilds).toBe(true);
  });

  it.each(['- item', 'null', 'true', 'text', '42'])('rejects a non-mapping root: %s', (text) => {
    expect.hasAssertions();
    expect(() => yamlCodec.parse(text)).toThrow(/config root must be a mapping/iu);
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

  it.each([
    'root: &self { child: *self }',
    'root: &self [*self]',
    'root: &a { child: &b { parent: *a } }',
  ])('rejects cyclic aliases: %s', (text) => {
    expect(() => yamlCodec.parse(text)).toThrow(/circular/u);
  });

  it('preserves shared mappings without treating them as cycles', () => {
    expect(yamlCodec.parse('one: &shared { enabled: true }\ntwo: *shared')).toEqual({
      one: { enabled: true },
      two: { enabled: true },
    });
  });

  it('rejects a malformed document', () => {
    expect.hasAssertions();
    expect(() => yamlCodec.parse('enableScripts: [')).toThrow(/./u);
  });

  it('preserves nested sequences without treating their entries as root keys', () => {
    expect.hasAssertions();
    const text = [
      '# pnpm settings',
      'minimumReleaseAge: 1440',
      'trustPolicyExclude:',
      '  - chokidar@4.0.3',
    ].join('\n');
    const config = yamlCodec.parse(text);
    expect(config.minimumReleaseAge).toBe(MINIMUM_RELEASE_AGE_MINUTES);
    expect(config.trustPolicyExclude).toEqual(['chokidar@4.0.3']);
  });
});
