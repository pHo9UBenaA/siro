import type { LintDependencies } from './contracts/lint-dependencies.ts';
import type { FileSystem } from './contracts/file-system.ts';
import type { AbsPath, RelPath } from './contracts/paths.ts';
import { asRelPath } from './contracts/paths.ts';
import type { ProjectType } from './contracts/project-type.ts';
import { ConfigError } from './contracts/errors.ts';
import { CONFIG_FILES } from './config-files.ts';
import { validateDenoMetadata } from './contracts/deno-json.ts';
import { createRepositoryEvaluation, type RepositoryEvaluation } from './parse-config-file.ts';

export interface DiscoveredDirectory {
  readonly directory: RelPath;
  readonly repository: RepositoryEvaluation;
  readonly manifests: readonly ('package.json' | 'deno.json')[];
}

/** One context per selected directory, shared by publication and installation passes. */
export const discover = (
  cwd: AbsPath,
  fs: FileSystem,
  excluded: (directory: string) => boolean,
  projectType: ProjectType | undefined,
  dependencies: LintDependencies,
): DiscoveredDirectory[] => {
  if (typeof fs.readDirectories !== 'function')
    throw new ConfigError(
      'FileSystem.readDirectories is required for package discovery; no native filesystem fallback is used.',
    );
  const { paths, createRepoContext, codecFor } = dependencies;
  const pending = [asRelPath('.')];
  const directories: DiscoveredDirectory[] = [];
  while (pending.length) {
    const directory = pending.pop()!;
    const absolute = paths.resolve(cwd, directory);
    let repository: RepositoryEvaluation;
    const manifests: ('package.json' | 'deno.json')[] = [];
    try {
      repository = createRepositoryEvaluation(
        createRepoContext(absolute, fs, projectType),
        codecFor,
      );
      const { ctx, parseConfig } = repository;
      if (ctx.packageJson !== undefined) manifests.push('package.json');
      if (ctx.readText(CONFIG_FILES.denoJson.path) !== undefined) {
        validateDenoMetadata(parseConfig(CONFIG_FILES.denoJson));
        manifests.push('deno.json');
      } else if (ctx.exists(asRelPath('deno.jsonc'))) {
        throw new ConfigError('deno.jsonc is not supported; use strict deno.json.');
      }
    } catch (error) {
      if (error instanceof ConfigError && directory !== '.')
        throw new ConfigError(`${directory}/${error.message}`);
      throw error;
    }
    directories.push({ directory, repository, manifests });
    const names: unknown = fs.readDirectories(absolute);
    if (!Array.isArray(names))
      throw new ConfigError(`${directory}: FileSystem.readDirectories must return a dense array.`);
    const children = new Set<RelPath>();
    for (let i = 0; i < names.length; i += 1) {
      if (!Object.hasOwn(names, i))
        throw new ConfigError(
          `${directory}: FileSystem.readDirectories must return a dense array.`,
        );
      const child = paths.child(directory, names[i]);
      if (
        names[i] === '.git' ||
        names[i] === 'node_modules' ||
        excluded(child) ||
        children.has(child)
      )
        continue;
      children.add(child);
      pending.push(child);
    }
  }
  return directories.sort((a, b) =>
    a.directory < b.directory ? -1 : a.directory > b.directory ? 1 : 0,
  );
};
