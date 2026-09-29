import type { RepoContext } from '../../src/core/contracts/repo-context.ts';
import type { PackageJson } from '../../src/core/contracts/package-json.ts';
import { detectPMs } from '../../src/core/detect-pms.ts';
import { makeCtx } from '../helpers/ctx.ts';

const ctx = (files: readonly string[], packageJson?: PackageJson): RepoContext =>
  makeCtx({ files, packageJson });

describe(detectPMs, () => {
  it('uses the packageManager field as the strongest signal', () => {
    expect.hasAssertions();
    expect(detectPMs(ctx([], { packageManager: 'pnpm@10.9.0' }))).toStrictEqual(['pnpm']);
  });

  it('detects a PM from its lockfile', () => {
    expect.hasAssertions();
    expect(detectPMs(ctx(['aube-lock.yaml']))).toStrictEqual(['aube']);
  });

  it('returns an empty list when nothing is detected', () => {
    expect.hasAssertions();
    expect(detectPMs(ctx([]))).toStrictEqual([]);
  });

  // aube reuses other PMs' lockfile shapes (pnpm-lock.yaml, package-lock.json, ...)
  // when one already exists in the repo, so those filenames must NOT trigger an
  // aube false-positive on a pnpm/yarn/npm/bun repo that has never touched aube.
  // https://aube.en.dev/package-manager/lockfiles
  it("does not flag aube when only another PM's lockfile is present", () => {
    expect.hasAssertions();
    expect(detectPMs(ctx(['pnpm-lock.yaml']))).toStrictEqual(['pnpm']);
    expect(detectPMs(ctx(['package-lock.json']))).toStrictEqual(['npm']);
    expect(detectPMs(ctx(['yarn.lock']))).toStrictEqual(['yarn']);
    expect(detectPMs(ctx(['bun.lock']))).toStrictEqual(['bun']);
  });

  it('detects aube when aube-workspace.yaml is the only signal (no packageManager field, no lockfile)', () => {
    expect.hasAssertions();
    expect(detectPMs(ctx(['aube-workspace.yaml']))).toStrictEqual(['aube']);
  });

  it('detects npm from npm-shrinkwrap.json alone', () => {
    expect.hasAssertions();
    // npm-shrinkwrap.json is a legitimate npm-only artifact (published, unlike
    // package-lock.json). A repo with only a shrinkwrap and no packageManager
    // field must still resolve to npm rather than "no PM detected" (exit 2).
    expect(detectPMs(ctx(['npm-shrinkwrap.json']))).toStrictEqual(['npm']);
  });

  it('ignores an unknown packageManager value', () => {
    expect.hasAssertions();
    expect(detectPMs(ctx([], { packageManager: 'cargo@1.0.0' }))).toStrictEqual([]);
  });
});
