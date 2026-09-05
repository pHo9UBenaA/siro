import type { RepoContext } from '../../src/domain/ports/repo-context.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

const DEFAULT_ROOT = asAbsPath(path.join(tmpdir(), 'siro-test'));
type ContextOptions = Partial<RepoContext> & { files?: readonly string[] };

export const makeCtx = (overrides: ContextOptions = {}): RepoContext => {
  const present = new Set(overrides.files);
  return {
    exists: overrides.exists ?? ((file) => present.has(file)),
    packageJson: overrides.packageJson,
    projectType: overrides.projectType,
    readText: overrides.readText ?? (() => undefined),
    root: overrides.root ?? DEFAULT_ROOT,
  };
};

export const makePublishableCtx = (overrides: ContextOptions = {}): RepoContext =>
  makeCtx({ ...overrides, packageJson: { name: 'x', ...overrides.packageJson } });
