import type { ProjectType } from '../entities/project-type.ts';
import { type ParsedConfig, getByPath } from '../entities/config-value.ts';
import type { RepoContext } from '../ports/repo-context.ts';

const isPublishableName = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const resolveProjectType = (
  selected: ProjectType | undefined,
  inferredPackage: boolean,
): ProjectType => selected ?? (inferredPackage ? 'package' : 'application');

export const resolvePackageJsonProjectType = (ctx: RepoContext): ProjectType => {
  const pkg = ctx.packageJson;
  const inferredPackage = pkg?.private !== true && isPublishableName(pkg?.name);
  return resolveProjectType(ctx.projectType, inferredPackage);
};

export const resolveDenoProjectType = (ctx: RepoContext, denoConfig: ParsedConfig): ProjectType =>
  resolveProjectType(ctx.projectType, isPublishableName(getByPath(denoConfig, ['name'])));
