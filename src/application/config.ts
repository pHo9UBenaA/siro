import * as vb from 'valibot';
import { PMS, SEVERITIES } from '../domain/entities/pms.ts';
import { PROJECT_TYPES } from '../domain/entities/project-type.ts';
import { type Reporter, isReporterShape } from '../domain/ports/reporter.ts';
import { type Rule, isRuleShape } from '../domain/entities/rule.ts';
import type { RuleSetting, SiroConfig } from '../domain/entities/siro-config.ts';
import { isPlainRecord } from '../shared/records.ts';
import { ConfigError } from '../shared/errors.ts';

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

export const parseConfig = (candidate: unknown, name = 'siro.config'): SiroConfig => {
  if (!isPlainRecord(candidate)) {
    throw new ConfigError(
      `${name} must export a config object (got ${Array.isArray(candidate) ? 'an array' : typeof candidate}).`,
    );
  }
  // Copy own properties only; inherited config values must not affect evaluation.
  const result = vb.safeParse(ConfigSchema, Object.fromEntries(Object.entries(candidate)));
  if (!result.success) {
    throw new ConfigError(`${name}: ${formatIssues(result.issues)}`);
  }
  return result.output;
};
