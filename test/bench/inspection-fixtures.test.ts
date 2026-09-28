import { fixtures } from '../../bench/fixtures.ts';
import { asAbsPath, lint } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';

it.each(fixtures)('measures the declared real input scope: $name', (fixture) => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    fs: createMemFileSystem(fixture.files, '/'),
    ...fixture.options,
  });
  expect(result.inspection.manifests).toHaveLength(fixture.expectedScope.manifests);
  expect(result.inspection.installationRoots).toHaveLength(fixture.expectedScope.installationRoots);
});

it('covers recursive packages, independent installations and exclusions, not only config size', () => {
  expect(
    fixtures.some((f) => f.expectedScope.manifests > 1 && f.expectedScope.installationRoots === 0),
  ).toBe(true);
  expect(fixtures.some((f) => f.expectedScope.installationRoots > 1)).toBe(true);
  expect(fixtures.some((f) => f.options?.exclude?.length)).toBe(true);
});
