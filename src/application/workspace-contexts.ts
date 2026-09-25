import type { LintDependencies } from './ports/lint-dependencies.ts';
import { CONFIG_FILES } from '../domain/entities/config-files.ts';
import { createConfigParser, type ConfigParser } from '../domain/services/parse-config-file.ts';
import { asRelPath } from '../shared/paths.ts';
import { ConfigError } from '../shared/errors.ts';
import type { RepoContext } from '../domain/ports/repo-context.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import type { PM } from '../domain/entities/pms.ts';
import type { ProjectType } from '../domain/entities/project-type.ts';
import { workspaceDefinitions } from './workspace-definitions.ts';
import { workspaceDirectories } from './workspaces.ts';

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
    const seen = new Set<string>();
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
            const memberCtx = createRepoContext(root, memberFs, projectType);
            const memberParse = createConfigParser(codecFor, memberCtx);
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
            if (seen.has(directory)) return [];
            seen.add(directory);
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
