import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type AbsPath, asAbsPath } from '../shared/paths.ts';
import type { SiroConfig } from '../domain/entities/siro-config.ts';
import { ConfigError } from '../shared/errors.ts';
import { SUPPORTED_NODE_RANGE, isSupportedNodeVersion } from '../shared/node-version.ts';
import { nodeFileSystem } from './node-file-system.ts';
import { parseConfig } from '../application/config.ts';

const CONFIG_NAMES = ['siro.config.ts', 'siro.config.mjs', 'siro.config.js'] as const;
const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// ESM caches by URL; a new query reloads the config entry, not its transitive imports.
let loadCounter = 0;

/** Load the first matching config; executable imports always use the real filesystem. */
export const loadConfig = async (
  cwd: AbsPath,
  nodeVersion: string = process.versions.node,
): Promise<SiroConfig | undefined> => {
  const name = CONFIG_NAMES.find((candidate) =>
    nodeFileSystem.exists(asAbsPath(path.join(cwd, candidate))),
  );
  if (name === undefined) {
    return undefined;
  }

  if (name.endsWith('.ts') && !isSupportedNodeVersion(nodeVersion)) {
    throw new ConfigError(
      `${name} requires Node.js with native type stripping (${SUPPORTED_NODE_RANGE}); current is v${nodeVersion}. Rename the config to siro.config.mjs (plain JS) or upgrade Node.js.`,
    );
  }
  const url = pathToFileURL(path.join(cwd, name));
  url.searchParams.set('siro-load', String(++loadCounter));
  let mod: unknown;
  try {
    mod = await import(url.href);
  } catch (error) {
    throw new ConfigError(`Failed to load ${name}: ${describeError(error)}`);
  }
  const candidate = mod !== null && typeof mod === 'object' && 'default' in mod ? mod.default : mod;
  return parseConfig(candidate, name);
};
