import type { RepoContext } from '../contracts/repo-context.ts';
import { resolvePackageJsonProjectType } from '../resolve-project-type.ts';

export const isPublishable = (ctx: RepoContext): boolean =>
  resolvePackageJsonProjectType(ctx) === 'package';
