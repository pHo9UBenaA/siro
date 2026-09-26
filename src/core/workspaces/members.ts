import type { LintDependencies } from '../contracts/lint-dependencies.ts';
import { CONFIG_FILES } from '../config-files.ts';
import { createConfigParser, type ConfigParser } from '../parse-config-file.ts';
import { asRelPath } from '../contracts/paths.ts';
import { ConfigError } from '../contracts/errors.ts';
import type { RepoContext } from '../contracts/repo-context.ts';
import type { FileSystem } from '../contracts/file-system.ts';
import type { PM } from '../contracts/pms.ts';
import type { ProjectType } from '../contracts/project-type.ts';
import { workspaceDefinitions } from './declarations.ts';
import { workspaceDirectories } from './walk.ts';

/** Expand each manager's declarations into isolated publication contexts. */
export const collectWorkspaceMembers = (
  ctx: RepoContext,
  rootParse: ConfigParser,
  fs: FileSystem,
  pms: readonly PM[],
  projectType: ProjectType | undefined,
  dependencies: Pick<
    LintDependencies,
    'codecFor' | 'createRepoContext' | 'paths' | 'globs' | 'caseInsensitiveGlobs'
  >,
) => {
  const { codecFor, createRepoContext, paths } = dependencies;
  return pms.flatMap((pm) => {
    const contexts = new Map<string, { ctx: RepoContext; parseConfig: ConfigParser }>();
    return workspaceDefinitions(ctx, pm, dependencies, rootParse).flatMap((definition) =>
      workspaceDirectories(ctx, fs, definition, pm, dependencies, rootParse).flatMap(
        ({ directory, explicitMember }) => {
          const root = paths.resolve(ctx.root, directory);
          const manifest = paths.resolve(root, asRelPath('package.json'));
          const denoManifest = paths.resolve(root, asRelPath('deno.json'));
          const denoJsonc = paths.resolve(root, asRelPath('deno.jsonc'));
          // Child publication metadata only; root installation settings are not merged.
          const allowed = new Set(pm === 'deno' ? [manifest, denoManifest, denoJsonc] : [manifest]);
          const memberFs: FileSystem = {
            exists: (file) => allowed.has(file) && fs.exists(file),
            readText: (file) => (allowed.has(file) ? fs.readText(file) : undefined),
          };
          try {
            if (!definition.fromDenoJson && !fs.exists(manifest)) {
              if (pm === 'deno' && explicitMember)
                throw new ConfigError('Declared npm workspace member has no package.json.');
              return [];
            }
            if (pm === 'deno' && !fs.exists(denoManifest) && fs.exists(denoJsonc)) {
              throw new ConfigError('deno.jsonc is not supported; use strict deno.json.');
            }
            // Reuse accepted members within this PM, but still validate each declaration's
            // manifest requirements: a native Deno member may lack npm's package.json.
            const cached = contexts.get(directory);
            const memberCtx = cached?.ctx ?? createRepoContext(root, memberFs, projectType);
            const memberParse = cached?.parseConfig ?? createConfigParser(codecFor, memberCtx);
            if (!definition.fromDenoJson && !memberCtx.packageJson) return [];
            if (!memberCtx.packageJson && !memberCtx.exists(asRelPath('deno.json'))) {
              if (definition.fromDenoJson && explicitMember) {
                throw new ConfigError('Declared Deno member has no deno.json or package.json.');
              }
              return [];
            }
            if (pm === 'deno') {
              const deno = memberParse(CONFIG_FILES.denoJson);
              if (deno.workspace !== undefined || memberCtx.packageJson?.workspaces !== undefined) {
                throw new ConfigError('Nested workspace declarations are not supported by Deno.');
              }
            }
            if (cached) return [];
            contexts.set(directory, { ctx: memberCtx, parseConfig: memberParse });
            return [{ directory, pm, ctx: memberCtx, parseConfig: memberParse }];
          } catch (error) {
            if (error instanceof ConfigError)
              throw new ConfigError(`${directory}/${error.message}`);
            throw error;
          }
        },
      ),
    );
  });
};
