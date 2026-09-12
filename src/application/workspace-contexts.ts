import path from 'node:path';
import { CONFIG_FILES } from '../domain/entities/config-files.ts';
import { createConfigParser } from '../domain/services/parse-config-file.ts';
import { codecFor } from '../adapters/codecs/store.ts';
import { createRepoContext } from '../adapters/repo-context.ts';
import { resolveIn } from '../adapters/node-file-system.ts';
import { asRelPath } from '../shared/paths.ts';
import { ConfigError } from '../shared/errors.ts';
import type { RepoContext } from '../domain/ports/repo-context.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import type { PM } from '../domain/entities/pms.ts';
import type { ProjectType } from '../domain/entities/project-type.ts';
import { workspaceDirectories, workspaceDefinitions } from './workspaces.ts';

/** Expand each manager's declarations into isolated publication contexts. */
export const collectWorkspaceMembers = (
  ctx: RepoContext,
  fs: FileSystem,
  pms: readonly PM[],
  projectType: ProjectType | undefined,
) =>
  pms.flatMap((pm) => {
    const seen = new Set<string>();
    return workspaceDefinitions(ctx, pm).flatMap((definition) =>
      workspaceDirectories(ctx, fs, definition, pm).flatMap((directory) => {
        const root = resolveIn(ctx.root, directory);
        const manifest = resolveIn(root, asRelPath('package.json'));
        const denoManifest = resolveIn(root, asRelPath('deno.json'));
        const denoJsonc = resolveIn(root, asRelPath('deno.jsonc'));
        // Child publication metadata only; root installation settings are not merged.
        const allowed = new Set(pm === 'deno' ? [manifest, denoManifest, denoJsonc] : [manifest]);
        const memberFs: FileSystem = {
          exists: (file) => allowed.has(file) && fs.exists(file),
          readText: (file) => (allowed.has(file) ? fs.readText(file) : undefined),
        };
        try {
          const explicitMember = definition.patterns.some(
            (pattern) =>
              !pattern.startsWith('!') &&
              !/[*?]/u.test(pattern) &&
              path.posix.normalize(pattern).replace(/\/+$/u, '') === directory,
          );
          if (!definition.denoManifests && !fs.exists(manifest)) {
            if (pm === 'deno' && explicitMember)
              throw new ConfigError('Declared npm workspace member has no package.json.');
            return [];
          }
          if (pm === 'deno' && !fs.exists(denoManifest) && fs.exists(denoJsonc)) {
            throw new ConfigError('deno.jsonc is not supported; use strict deno.json.');
          }
          const memberCtx = createRepoContext(root, memberFs, projectType);
          if (!definition.denoManifests && !memberCtx.packageJson) return [];
          if (!memberCtx.packageJson && !memberCtx.exists(asRelPath('deno.json'))) {
            if (definition.denoManifests && explicitMember) {
              throw new ConfigError('Declared Deno member has no deno.json or package.json.');
            }
            return [];
          }
          if (pm === 'deno') {
            const deno = createConfigParser(codecFor, memberCtx)(CONFIG_FILES.denoJson);
            if (deno.workspace !== undefined || memberCtx.packageJson?.workspaces !== undefined) {
              throw new ConfigError('Nested workspace declarations are not supported by Deno.');
            }
          }
          if (seen.has(directory)) return [];
          seen.add(directory);
          return [{ directory, pm, ctx: memberCtx }];
        } catch (error) {
          if (error instanceof ConfigError) throw new ConfigError(`${directory}/${error.message}`);
          throw error;
        }
      }),
    );
  });
