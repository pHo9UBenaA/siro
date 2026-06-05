import assert from 'node:assert';
import { safeParsePackageJson } from '../../../src/domain/schemas/package-json.ts';

vi.setConfig({ testTimeout: 5000 });

describe(safeParsePackageJson, () => {
  it('passes well-formed manifests through unchanged', () => {
    expect.hasAssertions();
    const pkg = {
      files: ['dist'],
      name: 'demo',
      private: false,
      scripts: { build: 'tsc' },
      version: '1.0.0',
    };
    expect(safeParsePackageJson(pkg)).toStrictEqual(pkg);
  });

  it('preserves unknown keys (looseObject)', () => {
    expect.hasAssertions();
    const pkg = { name: 'demo', somethingElse: { nested: true } };
    expect(safeParsePackageJson(pkg)).toMatchObject(pkg);
  });

  it('keeps the manifest parseable when one field is type-mismatched (per-field fallback)', () => {
    expect.hasAssertions();
    const out = safeParsePackageJson({ files: 'dist', packageManager: 'npm@10.9.0' });
    assert(out, 'expected parsed output');
    expect(out.packageManager).toBe('npm@10.9.0');
    expect(out.files).toBeUndefined();
  });

  it('treats a non-boolean `private` as private — fail-safe for a security tool', () => {
    expect.hasAssertions();
    const namedPkg = safeParsePackageJson({ name: 'x' });
    assert(namedPkg, 'expected parsed output');
    expect(namedPkg.private).toBeUndefined();
    const privatePkg = safeParsePackageJson({ private: 'yes' });
    assert(privatePkg, 'expected parsed output');
    expect(privatePkg.private).toBe(true);
  });

  it('returns undefined only for non-objects', () => {
    expect.hasAssertions();
    expect(safeParsePackageJson(JSON.parse('null'))).toBeUndefined();
    expect(safeParsePackageJson('not an object')).toBeUndefined();
  });
});

describe('packageJsonSchema publishConfig.access', () => {
  it('parses "public" and "restricted" through to the typed field', () => {
    expect.hasAssertions();
    expect(safeParsePackageJson({ name: 'x', publishConfig: { access: 'public' } })).toStrictEqual({
      name: 'x',
      publishConfig: { access: 'public' },
    });
    expect(
      safeParsePackageJson({ name: 'x', publishConfig: { access: 'restricted' } }),
    ).toStrictEqual({
      name: 'x',
      publishConfig: { access: 'restricted' },
    });
  });

  it('falls back to undefined for any other string so other fields keep parsing', () => {
    expect.hasAssertions();
    const out = safeParsePackageJson({ name: 'x', publishConfig: { access: 'junk' } });
    assert(out, 'expected parsed output');
    expect(out.name).toBe('x');
    const pubCfg = out.publishConfig;
    assert(pubCfg, 'expected publishConfig');
    expect(pubCfg.access).toBeUndefined();
  });

  const NON_STRING_NUMBER = 42;
  it.each([NON_STRING_NUMBER, JSON.parse('null'), true, false])(
    'falls back to undefined for non-string value %p',
    (access: unknown) => {
      expect.hasAssertions();
      const out = safeParsePackageJson({ name: 'x', publishConfig: { access } });
      assert(out, 'expected parsed output');
      const pubCfg = out.publishConfig;
      assert(pubCfg, 'expected publishConfig');
      expect(pubCfg.access).toBeUndefined();
    },
  );

  it('falls back to undefined for symbol values', () => {
    expect.hasAssertions();
    const symResult = safeParsePackageJson({ name: 'x', publishConfig: { access: Symbol('s') } });
    assert(symResult, 'expected parsed output');
    const symPubCfg = symResult.publishConfig;
    assert(symPubCfg, 'expected publishConfig');
    expect(symPubCfg.access).toBeUndefined();
  });

  it('falls back to undefined for bigint values', () => {
    expect.hasAssertions();
    const bigResult = safeParsePackageJson({ name: 'x', publishConfig: { access: 10n } });
    assert(bigResult, 'expected parsed output');
    const bigPubCfg = bigResult.publishConfig;
    assert(bigPubCfg, 'expected publishConfig');
    expect(bigPubCfg.access).toBeUndefined();
  });
});
