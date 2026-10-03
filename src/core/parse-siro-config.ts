import * as vb from 'valibot';
import {
  parseExcludes,
  parseInstallationRoots,
  type InstallationRootInput,
} from './inspection-options.ts';
import { isPM, PMS, SEVERITIES } from './contracts/pms.ts';
import { PROJECT_TYPES } from './contracts/project-type.ts';
import { type Reporter, isReporterShape } from './contracts/reporter.ts';
import { type Rule, isRuleShape } from './contracts/rule.ts';
import type { RuleSetting, SiroConfig } from './siro-config.ts';
import { isPlainRecord } from './contracts/records.ts';
import { ConfigError } from './contracts/errors.ts';
import { isStableVersion } from './pm-versions.ts';
import { assertSynchronous } from './contracts/synchronous.ts';
import { scopeOf } from './rules/builtin-rules.ts';

const RuleSettingSchema = vb.union([vb.picklist(SEVERITIES), vb.literal('off')]);

const RuleOverridesSchema = vb.pipe(
  vb.custom<Record<string, unknown>>(isPlainRecord, 'must be an object of rule settings'),
  // record() drops own keys such as constructor, which are valid custom rule IDs.
  vb.rawTransform(({ dataset, addIssue }) => {
    const entries: [string, RuleSetting][] = [];
    for (const [key, value] of Object.entries(dataset.value)) {
      const result = vb.safeParse(RuleSettingSchema, value);
      if (result.success) entries.push([key, result.output]);
      else
        addIssue({
          message: result.issues[0].message,
          path: [{ input: dataset.value, key, origin: 'value', type: 'object', value }],
        });
    }
    return Object.fromEntries(entries);
  }),
);

const DataConfigEntries = {
  exclude: vb.optional(
    vb.custom<readonly string[]>((value) => {
      parseExcludes(value);
      return true;
    }),
  ),
  installationRoots: vb.optional(
    vb.custom<readonly InstallationRootInput[]>((value) => {
      parseInstallationRoots(value);
      return true;
    }),
  ),
  pms: vb.optional(
    vb.pipe(
      vb.array(vb.picklist(PMS)),
      vb.minLength(1, 'must not be empty (omit the key to auto-detect, or list at least one PM)'),
    ),
  ),
  projectType: vb.optional(vb.picklist(PROJECT_TYPES)),
  pmVersions: vb.optional(
    vb.pipe(
      vb.custom<Record<string, unknown>>(isPlainRecord, 'must be an object of PM versions'),
      vb.check((value) => Object.keys(value).every(isPM), 'unknown package manager in pmVersions'),
      vb.record(
        vb.picklist(PMS),
        vb.custom<string>(isStableVersion, 'must be an exact stable version such as 10.16.0'),
      ),
    ),
  ),
  rules: vb.optional(RuleOverridesSchema),
};

const ConfigSchema = vb.strictObject(
  {
    ...DataConfigEntries,
    customRules: vb.optional(
      vb.array(vb.custom<Rule>(isRuleShape, 'must be a structurally valid rule')),
    ),
    reporters: vb.optional(
      vb.array(vb.custom<Reporter>(isReporterShape, 'must be a { name, format } reporter')),
    ),
  },
  'unknown config key (check for a typo)',
);
const JsonConfigSchema = vb.strictObject(
  DataConfigEntries,
  'unknown JSON config key; custom rules and reporters require executable configuration',
);

const formatIssues = (
  issues: readonly { path?: readonly { key?: unknown }[]; message: string }[],
): string =>
  issues
    .map((issue) => {
      const keys: (string | number)[] = [];
      for (const segment of issue.path ?? []) {
        const key = segment.key;
        if (typeof key === 'string' || typeof key === 'number') keys.push(key);
      }
      const keyPath = keys.join('.');
      if (keyPath) {
        return `${keyPath}: ${issue.message}`;
      }
      return issue.message;
    })
    .join('; ');

const parseConfigObject = (
  candidate: unknown,
  name: string,
  schema: typeof ConfigSchema | typeof JsonConfigSchema,
): SiroConfig => {
  assertSynchronous(candidate, name);
  if (!isPlainRecord(candidate)) {
    throw new ConfigError(
      `${name} must be a config object (got ${Array.isArray(candidate) ? 'an array' : typeof candidate}).`,
    );
  }
  // Copy own properties only; inherited config values must not affect evaluation.
  const result = vb.safeParse(schema, Object.fromEntries(Object.entries(candidate)));
  if (!result.success) {
    throw new ConfigError(`${name}: ${formatIssues(result.issues)}`);
  }
  return result.output;
};

export const parseConfig = (candidate: unknown, name = 'siro.config'): SiroConfig =>
  parseConfigObject(candidate, name, ConfigSchema);

/** Data-only settings cannot register extensions or refer to custom rule IDs. */
export const parseJsonConfig = (candidate: unknown, name: string): SiroConfig => {
  const config = parseConfigObject(candidate, name, JsonConfigSchema);
  for (const id of Object.keys(config.rules ?? {})) {
    if (scopeOf(id) === 'custom') throw new ConfigError(`${name}: unknown built-in rule ${id}.`);
  }
  return config;
};
