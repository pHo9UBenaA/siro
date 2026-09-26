import type { LintDependencies } from '../contracts/lint-dependencies.ts';
import { CONFIG_FILES } from '../config-files.ts';
import { createRepositoryEvaluation, type RepositoryEvaluation } from '../parse-config-file.ts';
import { asRelPath, type RelPath } from '../contracts/paths.ts';
import { ConfigError } from '../contracts/errors.ts';
import type { FileSystem } from '../contracts/file-system.ts';
import type { PM } from '../contracts/pms.ts';
import type { ProjectType } from '../contracts/project-type.ts';
import { workspaceDefinitions } from './declarations.ts';
import { workspaceDirectories } from './walk.ts';

export interface WorkspaceMember {
  readonly directory: RelPath;
  readonly pm: PM;
  readonly repository: RepositoryEvaluation;
}

interface WorkspaceMemberOptions {
  readonly root: RepositoryEvaluation;
  readonly fs: FileSystem;
  readonly pms: readonly PM[];
  readonly projectType?: ProjectType;
}

/** Expand each manager's declarations into isolated publication contexts. */
export const collectWorkspaceMembers = (
  options: WorkspaceMemberOptions,
  dependencies: Pick<
    LintDependencies,
    'codecFor' | 'createRepoContext' | 'paths' | 'globs' | 'caseInsensitiveGlobs'
  >,
): readonly WorkspaceMember[] => {
  const { root, fs, pms, projectType } = options;
  const { ctx, parseConfig } = root;
  const { codecFor, createRepoContext, paths } = dependencies;
  const members: WorkspaceMember[] = [];

  for (const pm of pms) {
    const contexts = new Map<string, RepositoryEvaluation>();
    // Validate every declaration source before walking this manager's members.
    const definitions = workspaceDefinitions(ctx, pm, dependencies, parseConfig);
    for (const definition of definitions) {
      // Finish discovery and sorting before reading any candidate manifest.
      const candidates = workspaceDirectories(ctx, fs, definition, pm, dependencies, parseConfig);
      for (const { directory, explicitMember } of candidates) {
        const memberRoot = paths.resolve(ctx.root, directory);
        const manifest = paths.resolve(memberRoot, asRelPath('package.json'));
        const denoManifest = paths.resolve(memberRoot, asRelPath('deno.json'));
        const denoJsonc = paths.resolve(memberRoot, asRelPath('deno.jsonc'));
        // Child publication metadata only; root installation settings are not merged.
        const allowed = new Set(pm === 'deno' ? [manifest, denoManifest, denoJsonc] : [manifest]);
        const memberFs: FileSystem = {
          exists: (file) => allowed.has(file) && fs.exists(file),
          readText: (file) => (allowed.has(file) ? fs.readText(file) : undefined),
        };
        try {
          if (!definition.fromDenoJson && !fs.exists(manifest)) {
            if (pm === 'deno' && explicitMember) {
              throw new ConfigError('Declared npm workspace member has no package.json.');
            }
            continue;
          }
          if (pm === 'deno' && !fs.exists(denoManifest) && fs.exists(denoJsonc)) {
            throw new ConfigError('deno.jsonc is not supported; use strict deno.json.');
          }
          // Reuse accepted members within this PM, but still validate each declaration's
          // manifest requirements: a native Deno member may lack npm's package.json.
          const cached = contexts.get(directory);
          const repository =
            cached ??
            createRepositoryEvaluation(
              createRepoContext(memberRoot, memberFs, projectType),
              codecFor,
            );
          const { ctx: memberCtx, parseConfig: memberParse } = repository;
          if (!definition.fromDenoJson && !memberCtx.packageJson) continue;
          if (!memberCtx.packageJson && !memberCtx.exists(asRelPath('deno.json'))) {
            if (definition.fromDenoJson && explicitMember) {
              throw new ConfigError('Declared Deno member has no deno.json or package.json.');
            }
            continue;
          }
          if (pm === 'deno') {
            const deno = memberParse(CONFIG_FILES.denoJson);
            if (deno.workspace !== undefined || memberCtx.packageJson?.workspaces !== undefined) {
              throw new ConfigError('Nested workspace declarations are not supported by Deno.');
            }
          }
          if (cached) continue;
          contexts.set(directory, repository);
          members.push({ directory, pm, repository });
        } catch (error) {
          if (error instanceof ConfigError) {
            throw new ConfigError(`${directory}/${error.message}`);
          }
          throw error;
        }
      }
    }
  }
  return members;
};
