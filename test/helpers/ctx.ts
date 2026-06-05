import type { PackageJson } from '../../src/domain/schemas/package-json.ts';
import type { RepoContext } from '../../src/domain/ports/repo-context.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

const DEFAULT_ROOT = asAbsPath(path.join(tmpdir(), 'siro-test'));

const existsFalse: RepoContext['exists'] = (): boolean => false;

export const makeCtx = (
  overrides: Partial<RepoContext> & { files?: readonly string[] } = {},
): RepoContext => {
  const { files } = overrides;
  let present: Set<string> | undefined = void 0;
  if (files) {
    present = new Set(files);
  }
  let existsFn: RepoContext['exists'] = existsFalse;
  if (present) {
    existsFn = (fp): boolean => present.has(fp);
  }
  return {
    exists: overrides.exists ?? existsFn,
    packageJson: overrides.packageJson ?? (void 0 satisfies PackageJson | undefined),
    readText: overrides.readText ?? ((): undefined => void 0),
    root: overrides.root ?? DEFAULT_ROOT,
  };
};

export const makePublishableCtx = (
  overrides: Partial<RepoContext> & { files?: readonly string[] } = {},
): RepoContext =>
  makeCtx(
    Object.assign({}, overrides, {
      packageJson: Object.assign({}, { name: 'x' }, overrides.packageJson),
    }),
  );
