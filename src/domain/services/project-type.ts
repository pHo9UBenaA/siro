import type { ProjectType } from '../entities/project-type.ts';
import { type ParsedConfig, getByPath } from '../entities/config-value.ts';
import type { RepoContext } from '../ports/repo-context.ts';

const resolveProjectType = (
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

export const resolveDenoProjectType = (ctx: RepoContext, denoConfig: ParsedConfig): ProjectType =>
  resolveProjectType(ctx.projectType, typeof getByPath(denoConfig, ['name']) === 'string');
