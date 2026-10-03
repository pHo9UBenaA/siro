import type { RepoContext } from '../../src/core/contracts/repo-context.ts';
import type { PackageJson } from '../../src/core/contracts/package-json.ts';
import { detectPMs } from '../../src/core/detect-pms.ts';
import { makeCtx } from '../helpers/ctx.ts';

const ctx = (files: readonly string[], packageJson?: PackageJson): RepoContext =>
  makeCtx({ files, packageJson });

describe(detectPMs, () => {
  it('detects the manager declared in packageManager', () => {
    expect(detectPMs(ctx([], { packageManager: 'pnpm@10.9.0' }))).toStrictEqual(['pnpm']);
  });

  it('detects a PM from its lockfile', () => {
    expect(detectPMs(ctx(['aube-lock.yaml']))).toStrictEqual(['aube']);
  });

  it('returns an empty list when nothing is detected', () => {
    expect(detectPMs(ctx([]))).toStrictEqual([]);
  });

  // Reused lockfiles satisfy Aube policy but are not evidence that the project uses Aube.
  it("does not flag aube when only another PM's lockfile is present", () => {
    expect(detectPMs(ctx(['pnpm-lock.yaml']))).toStrictEqual(['pnpm']);
    expect(detectPMs(ctx(['package-lock.json']))).toStrictEqual(['npm']);
    expect(detectPMs(ctx(['yarn.lock']))).toStrictEqual(['yarn']);
    expect(detectPMs(ctx(['bun.lock']))).toStrictEqual(['bun']);
  });

  it('detects aube when aube-workspace.yaml is the only signal (no packageManager field, no lockfile)', () => {
    expect(detectPMs(ctx(['aube-workspace.yaml']))).toStrictEqual(['aube']);
  });

  it('detects npm from npm-shrinkwrap.json alone', () => {
    expect(detectPMs(ctx(['npm-shrinkwrap.json']))).toStrictEqual(['npm']);
  });

  it('ignores an unknown packageManager value', () => {
    expect(detectPMs(ctx([], { packageManager: 'cargo@1.0.0' }))).toStrictEqual([]);
  });
});
