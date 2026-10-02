import { ConfigError } from './contracts/errors.ts';
import { isPlainRecord } from './contracts/records.ts';
import { isPM, type PM } from './contracts/pms.ts';
import { isStableVersion } from './pm-versions.ts';

export type InstallationRootInput =
  | string
  | {
      readonly path: string;
      readonly pm?: PM;
      readonly pmVersion?: string;
    };
export interface InstallationRoot {
  readonly path: string;
  readonly pm?: PM;
  readonly pmVersion?: string;
}

const denseArray = (value: unknown, name: string): unknown[] => {
  if (!Array.isArray(value)) throw new ConfigError(`${name} must be a dense array.`);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) throw new ConfigError(`${name} must be a dense array.`);
  }
  return value;
};

const normalizeScopePath = (value: unknown, name: 'exclude' | 'installationRoots'): string => {
  // Exclusions are portable patterns; literal roots retain native POSIX name characters.
  const invalidPattern =
    name === 'exclude' &&
    typeof value === 'string' &&
    (value.includes('\\') || /^[a-z]:/iu.test(value));
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\0') ||
    invalidPattern ||
    /^[\\/]/u.test(value) ||
    /^[a-z]:[\\/]/iu.test(value) ||
    value.split('/').includes('..')
  ) {
    throw new ConfigError(
      `${name}: expected a nonempty cwd-relative /-separated path without parent traversal.`,
    );
  }
  return (
    value
      .split('/')
      .filter((part) => part && part !== '.')
      .join('/') || '.'
  );
};

export const parseExcludes = (value: unknown): string[] => {
  const patterns = denseArray(value, 'exclude').map((input) => {
    const pattern = normalizeScopePath(input, 'exclude');
    if (pattern === '.' || pattern.startsWith('!'))
      throw new ConfigError('exclude cannot exclude cwd (.) or re-include with leading !.');
    return pattern;
  });
  return [...new Set(patterns)];
};

export const parseInstallationRoots = (value: unknown): InstallationRoot[] => {
  const roots = new Map<string, InstallationRoot>();
  for (const input of denseArray(value, 'installationRoots')) {
    if (
      typeof input !== 'string' &&
      (!isPlainRecord(input) ||
        Object.keys(input).some((key) => !['path', 'pm', 'pmVersion'].includes(key)))
    ) {
      throw new ConfigError(
        'installationRoots entries must be paths or { path, pm?, pmVersion? }.',
      );
    }
    const entry = typeof input === 'string' ? { path: input } : input;
    // Literal entries are later matched to host-validated enumerated directories,
    // never resolved directly. POSIX backslashes/colons may be actual name characters.
    const path = normalizeScopePath(entry.path, 'installationRoots');
    const { pm, pmVersion } = entry;
    if (
      (pm !== undefined && (typeof pm !== 'string' || !isPM(pm))) ||
      (pmVersion !== undefined && (!pm || !isStableVersion(pmVersion)))
    ) {
      throw new ConfigError(
        `${path}: pmVersion requires pm and an exact stable version; pm must be a supported manager.`,
      );
    }
    if (path === '.' && (pm !== undefined || pmVersion !== undefined)) {
      throw new ConfigError(
        'Use top-level pm / pmVersion / pms / pmVersions for installation root ".".',
      );
    }
    const root: InstallationRoot = { path, pm, pmVersion };
    const previous = roots.get(path);
    if (previous && (previous.pm !== root.pm || previous.pmVersion !== root.pmVersion))
      throw new ConfigError(`${path}: conflicting installationRoots entries.`);
    roots.set(path, root);
  }
  return [...roots.values()];
};
