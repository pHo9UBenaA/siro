import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { AbsPath } from './core/contracts/paths.ts';
import type { FileSystem } from './core/contracts/file-system.ts';
import { asAbsPath } from './adapters/node-paths.ts';
import type { SiroConfig } from './core/siro-config.ts';
import { ConfigError, wrapCodecError } from './core/contracts/errors.ts';
import { resolveScanLimits, type ScanLimits } from './core/contracts/scan-limits.ts';
import { SUPPORTED_NODE_RANGE, isSupportedNodeVersion } from './adapters/node-version.ts';
import { createNodeFileSystem } from './adapters/node-file-system.ts';
import { parseJson } from './adapters/codecs/json.ts';
import { parseConfig, parseJsonConfig } from './core/parse-siro-config.ts';
import { boundedFileSystem } from './core/bounded-file-system.ts';

const JSON_CONFIG_NAME = 'siro.config.json';
const EXECUTABLE_CONFIG_NAMES = ['siro.config.ts', 'siro.config.mjs', 'siro.config.js'] as const;

/** @inline */
interface LoadConfigOptions {
  /** Relative to cwd. JS/TS paths explicitly opt into execution with caller privileges. */
  readonly configPath?: string;
  readonly nodeVersion?: string;
  /** Bound native JSON reads and nesting; these limits do not sandbox executable config. */
  readonly limits?: Partial<ScanLimits>;
}

const readJsonConfig = (
  file: AbsPath,
  fs: FileSystem,
  maxDepth: number,
): SiroConfig | undefined => {
  const text = fs.readText(file);
  if (text === undefined) return undefined;
  return wrapCodecError(file, () => parseJsonConfig(parseJson(text, maxDepth), file));
};

const loadExecutableConfig = async (file: AbsPath, nodeVersion: string): Promise<SiroConfig> => {
  const name = path.basename(file);
  if (!['.ts', '.mjs', '.js'].includes(path.extname(file)))
    throw new ConfigError(`${name}: config must use .json, .ts, .mjs, or .js.`);
  if (name.endsWith('.ts') && !isSupportedNodeVersion(nodeVersion)) {
    throw new ConfigError(
      `${name} requires Node.js with native type stripping (${SUPPORTED_NODE_RANGE}); current is v${nodeVersion}. Use a .mjs config (plain JS) or upgrade Node.js.`,
    );
  }
  const url = pathToFileURL(file);
  // ESM caches by URL; a fresh query reloads the entry, not its transitive imports.
  url.searchParams.set('siro-load', randomUUID());
  let module: unknown;
  try {
    module = await import(url.href);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Failed to load ${name}: ${message}`);
  }
  const candidate =
    module !== null && typeof module === 'object' && 'default' in module ? module.default : module;
  return parseConfig(candidate, name);
};

/** Share CLI data-read budgets; executable imports bypass this port and use Node directly. */
export const loadConfigFromFileSystem = async (
  cwd: AbsPath,
  options: LoadConfigOptions,
  fs: FileSystem,
): Promise<SiroConfig | undefined> => {
  const limits = resolveScanLimits(options.limits);
  if (options.configPath !== undefined) {
    const file = asAbsPath(path.resolve(cwd, options.configPath));
    if (path.extname(file) !== '.json')
      return loadExecutableConfig(file, options.nodeVersion ?? process.versions.node);
    const config = readJsonConfig(file, fs, limits.maxConfigDepth);
    if (config === undefined) throw new ConfigError(`${file}: config file does not exist.`);
    return config;
  }

  const config = readJsonConfig(
    asAbsPath(path.join(cwd, JSON_CONFIG_NAME)),
    fs,
    limits.maxConfigDepth,
  );
  if (config !== undefined) return config;
  const name = EXECUTABLE_CONFIG_NAMES.find((candidate) =>
    fs.exists(asAbsPath(path.join(cwd, candidate))),
  );
  if (name !== undefined) {
    throw new ConfigError(
      `Found executable ${name}; it was not executed. Use siro.config.json for data-only settings, --config <path> to trust code, or --no-config to ignore repository configuration.`,
    );
  }
  return undefined;
};

/** Auto-load cwd's JSON settings; execute JS/TS only with an explicit configPath. */
export const loadConfig = async (
  cwd: AbsPath,
  options: LoadConfigOptions = {},
): Promise<SiroConfig | undefined> => {
  const limits = resolveScanLimits(options.limits);
  const fs = boundedFileSystem(createNodeFileSystem(limits), limits);
  return loadConfigFromFileSystem(cwd, options, fs);
};
