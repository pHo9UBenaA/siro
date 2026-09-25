import { parsePackageJson } from '../../../src/core/contracts/package-json.ts';
import { ConfigError } from '../../../src/core/contracts/errors.ts';

it.each(['public', 'restricted', 'private'])(
  'preserves %s access and other manifest fields without defaults',
  (access) => {
    const manifest = {
      name: 'demo',
      files: ['dist'],
      private: false,
      publishConfig: { access, registry: 'https://registry.npmjs.org' },
      scripts: { build: 'tsc' },
      version: '1.0.0',
      trustedDependencies: [],
    };
    expect(parsePackageJson(manifest)).toEqual(manifest);
    expect(parsePackageJson({})).toEqual({});
  },
);

it.each([null, []].map((value) => ({ value })))(
  'rejects a non-object manifest: $value',
  ({ value }) => {
    expect(() => parsePackageJson(value)).toThrow(ConfigError);
  },
);
