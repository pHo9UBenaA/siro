import type { LintDependencies } from './contracts/lint-dependencies.ts';
import type { FileSystem } from './contracts/file-system.ts';
import type { AbsPath, RelPath } from './contracts/paths.ts';
import { asRelPath } from './contracts/paths.ts';
import type { ProjectType } from './contracts/project-type.ts';
import { ConfigError } from './contracts/errors.ts';
import {
  checkConfigDepth,
  checkLimit,
  DEFAULT_SCAN_LIMITS,
  type ScanLimits,
} from './contracts/scan-limits.ts';
import { CONFIG_FILES } from './config-files.ts';
import { validateDenoMetadata } from './contracts/deno-json.ts';
import { createRepositoryEvaluation, type RepositoryEvaluation } from './parse-config-file.ts';

export interface DiscoveredDirectory {
  readonly directory: RelPath;
  readonly repository: RepositoryEvaluation;
  readonly manifests: readonly ('package.json' | 'deno.json')[];
}

const inspectManifests = (
  repository: RepositoryEvaluation,
  maxConfigDepth: number,
): ('package.json' | 'deno.json')[] => {
  const manifests: ('package.json' | 'deno.json')[] = [];
  const { ctx, parseConfig } = repository;
  checkConfigDepth(ctx.packageJson, maxConfigDepth);
  if (ctx.packageJson !== undefined) manifests.push('package.json');
  if (ctx.readText(CONFIG_FILES.denoJson.path) !== undefined) {
    validateDenoMetadata(parseConfig(CONFIG_FILES.denoJson));
    manifests.push('deno.json');
  } else if (ctx.exists(asRelPath('deno.jsonc'))) {
    throw new ConfigError('deno.jsonc is not supported; use strict deno.json.');
  }
  return manifests;
};

/** One context per selected directory, shared by publication and installation passes. */
export const discover = (
  cwd: AbsPath,
  fs: FileSystem,
  excluded: (directory: string) => boolean,
  projectType: ProjectType | undefined,
  dependencies: LintDependencies,
  limits: ScanLimits = DEFAULT_SCAN_LIMITS,
): DiscoveredDirectory[] => {
  const { paths, createRepoContext, codecFor } = dependencies;
  const pending = [asRelPath('.')];
  const directories: DiscoveredDirectory[] = [];
  while (pending.length) {
    const directory = pending.pop()!;
    checkLimit('maxDirectories', directories.length + pending.length + 1, limits);
    checkLimit('maxDirectoryDepth', directory === '.' ? 0 : directory.split('/').length, limits);
    const absolute = paths.resolve(cwd, directory);
    let repository: RepositoryEvaluation;
    let manifests: ('package.json' | 'deno.json')[];
    try {
      repository = createRepositoryEvaluation(
        createRepoContext(absolute, fs, projectType),
        codecFor,
        limits.maxConfigDepth,
      );
      manifests = inspectManifests(repository, limits.maxConfigDepth);
    } catch (error) {
      if (error instanceof ConfigError && directory !== '.')
        throw new ConfigError(`${directory}/${error.message}`);
      throw error;
    }
    directories.push({ directory, repository, manifests });
    const names: unknown = fs.readDirectories(absolute);
    const invalidEnumeration = `${directory}: FileSystem.readDirectories must return a dense array.`;
    if (!Array.isArray(names)) throw new ConfigError(invalidEnumeration);
    const children = new Set<RelPath>();
    for (let i = 0; i < names.length; i += 1) {
      if (!Object.hasOwn(names, i)) throw new ConfigError(invalidEnumeration);
      const name = names[i];
      const child = paths.child(directory, name);
      if (name === '.git' || name === 'node_modules' || excluded(child) || children.has(child))
        continue;
      checkLimit('maxDirectoryDepth', child.split('/').length, limits);
      const directoryCountWithChild = directories.length + pending.length + 1;
      checkLimit('maxDirectories', directoryCountWithChild, limits);
      children.add(child);
      pending.push(child);
    }
  }
  return directories.sort((a, b) =>
    a.directory < b.directory ? -1 : a.directory > b.directory ? 1 : 0,
  );
};
