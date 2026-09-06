import { parsePackageJson } from '../../../src/domain/schemas/package-json.ts';
import { ConfigError } from '../../../src/shared/errors.ts';

it('preserves supported and unknown manifest fields without substituting defaults', () => {
  const manifest = {
    name: 'demo',
    files: ['dist'],
    private: false,
    publishConfig: { access: 'public', registry: 'https://registry.npmjs.org' },
    scripts: { build: 'tsc' },
    version: '1.0.0',
    trustedDependencies: [],
  };
  expect(parsePackageJson(manifest)).toEqual(manifest);
  expect(parsePackageJson({})).toEqual({});
});

it.each([null, [], 'text', 42].map((value) => ({ value })))(
  'rejects a non-object manifest: $value',
  ({ value }) => {
    expect(() => parsePackageJson(value)).toThrow(ConfigError);
  },
);

it.each(['public', 'restricted', 'private'])('accepts publish access %s', (access) => {
  expect(parsePackageJson({ publishConfig: { access } }).publishConfig?.access).toBe(access);
});
