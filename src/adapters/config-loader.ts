import * as vb from 'valibot';
import { type AbsPath, asAbsPath } from '../shared/paths.ts';
import { PMS, SEVERITIES } from '../domain/entities/pms.ts';
import { type Reporter, isReporterShape } from '../domain/ports/reporter.ts';
import { ConfigError } from '../shared/errors.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import { type Rule, isRuleShape } from '../domain/entities/rule.ts';
import type { RuleSetting, SiroConfig } from '../domain/entities/siro-config.ts';
import { rules as builtinRules } from '../domain/builtin-rules.ts';
import { nodeFileSystem } from './node-file-system.ts';
import path from 'node:path';
import { isPlainRecord } from '../shared/records.ts';
import { pathToFileURL } from 'node:url';
import { SUPPORTED_NODE_RANGE, isSupportedNodeVersion } from '../shared/node-version.ts';
import { validateRuleIds } from '../domain/services/validate-rule-ids.ts';
import { PROJECT_TYPES } from '../domain/entities/project-type.ts';

const CONFIG_NAMES = ['siro.config.ts', 'siro.config.mjs', 'siro.config.js'] as const;

const RuleSettingSchema = vb.union([vb.picklist(SEVERITIES), vb.literal('off')]);

const ConfigSchema = vb.strictObject(
  {
    customRules: vb.optional(
      vb.array(vb.custom<Rule>(isRuleShape, 'must be a structurally valid rule')),
    ),
    pms: vb.optional(
      vb.pipe(
        vb.array(vb.picklist(PMS)),
        vb.minLength(1, 'must not be empty (omit the key to auto-detect, or list at least one PM)'),
      ),
    ),
    projectType: vb.optional(vb.picklist(PROJECT_TYPES)),
    reporters: vb.optional(
      vb.array(vb.custom<Reporter>(isReporterShape, 'must be a { name, format } reporter')),
    ),
    rules: vb.optional(
      vb.pipe(
        vb.custom<Record<string, unknown>>(isPlainRecord, 'must be an object of rule settings'),
        // record() drops own keys such as constructor, which are valid custom rule IDs.
        vb.rawTransform(({ dataset, addIssue }) => {
          const entries: [string, RuleSetting][] = [];
          for (const [key, value] of Object.entries(dataset.value)) {
            const result = vb.safeParse(RuleSettingSchema, value);
            if (result.success) {
              entries.push([key, result.output]);
            } else {
              addIssue({
                message: result.issues[0].message,
                path: [{ input: dataset.value, key, origin: 'value', type: 'object', value }],
              });
            }
          }
          return Object.fromEntries(entries);
        }),
      ),
    ),
  },
  'unknown config key (check for a typo)',
);

const describeError = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
};

const formatIssues = (
  issues: readonly { path?: readonly { key?: unknown }[]; message: string }[],
): string =>
  issues
    .map((issue) => {
      const keyPath = (issue.path ?? [])
        .map((seg) => seg.key)
        .filter((key): key is string | number => typeof key === 'string' || typeof key === 'number')
        .join('.');
      if (keyPath) {
        return `${keyPath}: ${issue.message}`;
      }
      return issue.message;
    })
    .join('; ');

const validateCandidateShape = (candidate: unknown, name: string): Record<string, unknown> => {
  // Built-ins and arrays are objects but not config maps; an empty own-key set
  // would otherwise be accepted as an empty config.
  if (!isPlainRecord(candidate)) {
    let got: string = typeof candidate;
    if (Array.isArray(candidate)) {
      got = 'an array';
    }
    throw new ConfigError(`${name} must export a config object (got ${got}).`);
  }
  return candidate;
};

const validateSchema = (candidate: object, name: string): SiroConfig => {
  const result = vb.safeParse(ConfigSchema, Object.fromEntries(Object.entries(candidate)));
  if (!result.success) {
    throw new ConfigError(`${name}: ${formatIssues(result.issues)}`);
  }
  return result.output;
};

const rejectDuplicateCustomRuleIds = (config: SiroConfig, name: string): void => {
  // Unknown IDs are checked after application-supplied custom rules are available.
  const { duplicates } = validateRuleIds(config, builtinRules);
  if (duplicates.length > 0) {
    let plural = '';
    if (duplicates.length > 1) {
      plural = 's';
    }
    throw new ConfigError(
      `${name}: duplicate customRule id${plural}: ${duplicates.map((id: string) => `'${id}'`).join(', ')}. Pick a unique id (or use 'rules' to override an existing rule's severity).`,
    );
  }
};

// ESM caches by URL; a new query reloads the config entry, not its transitive imports.
let loadCounter = 0;

/** Load the first matching config; executable imports always use the real filesystem. */
export const loadConfig = async (
  cwd: AbsPath,
  fs: FileSystem = nodeFileSystem,
  nodeVersion: string = process.versions.node,
): Promise<SiroConfig | undefined> => {
  const name = CONFIG_NAMES.find((candidate) => fs.exists(asAbsPath(path.join(cwd, candidate))));
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
  const config = validateSchema(validateCandidateShape(candidate, name), name);
  rejectDuplicateCustomRuleIds(config, name);
  return config;
};
