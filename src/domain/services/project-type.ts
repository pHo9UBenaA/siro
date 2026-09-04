import type { ProjectType } from '../entities/project-type.ts';
import type { RepoContext } from '../ports/repo-context.ts';

export const resolveProjectType = (
  selected: ProjectType | undefined,
  inferredPackage: boolean,
): ProjectType => {
  if (typeof selected !== 'undefined') {
    return selected;
  }
  if (inferredPackage) {
    return 'package';
  }
  return 'application';
};

export const resolvePackageJsonProjectType = (ctx: RepoContext): ProjectType => {
  const pkg = ctx.packageJson;
  const inferredPackage =
    pkg?.private !== true && typeof pkg?.name === 'string' && pkg.name.length > 0;
  return resolveProjectType(ctx.projectType, inferredPackage);
};
