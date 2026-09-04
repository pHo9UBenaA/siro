import type { RepoContext } from '../ports/repo-context.ts';
import { resolvePackageJsonProjectType, resolveProjectType } from '../services/project-type.ts';

export const isPackageProject = (ctx: RepoContext, inferred: boolean): boolean =>
  resolveProjectType(ctx.projectType, inferred) === 'package';

export const isPublishable = (ctx: RepoContext): boolean =>
  resolvePackageJsonProjectType(ctx) === 'package';
