import type { RepoContext } from '../ports/repo-context.ts';
import { resolvePackageJsonProjectType } from '../services/project-type.ts';

export const isPublishable = (ctx: RepoContext): boolean =>
  resolvePackageJsonProjectType(ctx) === 'package';
