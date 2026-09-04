import type { RepoContext } from '../ports/repo-context.ts';

export const isPackageProject = (ctx: RepoContext, inferred: boolean): boolean => {
  if (typeof ctx.projectType !== 'undefined') {
    return ctx.projectType === 'package';
  }
  return inferred;
};

export const isPublishable = (ctx: RepoContext): boolean => {
  const pkg = ctx.packageJson;
  if (typeof pkg === 'undefined') {
    return isPackageProject(ctx, false);
  }
  const inferred = pkg.private !== true && typeof pkg.name === 'string' && pkg.name.length > 0;
  return isPackageProject(ctx, inferred);
};
