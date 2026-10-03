import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { type AbsPath } from './core/contracts/paths.ts';
import { asAbsPath } from './adapters/node-paths.ts';
import type { SiroConfig } from './core/siro-config.ts';
import { ConfigError } from './core/contracts/errors.ts';
import { SUPPORTED_NODE_RANGE, isSupportedNodeVersion } from './adapters/node-version.ts';
import { nodeFileSystem } from './adapters/node-file-system.ts';
import { parseConfig } from './core/parse-siro-config.ts';

const CONFIG_NAMES = ['siro.config.ts', 'siro.config.mjs', 'siro.config.js'] as const;
const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const importConfig = async (url: URL, name: string): Promise<unknown> => {
  try {
    return await import(url.href);
  } catch (error) {
    throw new ConfigError(`Failed to load ${name}: ${describeError(error)}`);
  }
};

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
  // ESM caches by URL; a fresh query reloads the entry, not its transitive imports.
  url.searchParams.set('siro-load', randomUUID());
  const module = await importConfig(url, name);
  const candidate =
    module !== null && typeof module === 'object' && 'default' in module ? module.default : module;
  return parseConfig(candidate, name);
};
