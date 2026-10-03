import { guardRemediationAvailability } from '../remediation-availability.ts';
import { proposeChanges } from '../remediation.ts';
import type { RuleBinding, CheckStatus, Rule, VersionNote } from '../../contracts/rule.ts';
import type { ConfigFileRef } from '../../contracts/config-file-ref.ts';
import {
  type ConfigValue,
  type KeyPath,
  type ParsedConfig,
  getByPath,
} from '../../contracts/config-value.ts';
import { type PM, PMS, type Severity } from '../../contracts/pms.ts';
import type { RepoContext } from '../../contracts/repo-context.ts';

/** One public helper binding: setting requirement, safe-default policy and proposal. */
export interface RequireConfigKeySpec {
  readonly file: ConfigFileRef;
  readonly keyPath: KeyPath;
  /** Expected value and proposed replacement; `accept` may allow other values. */
  readonly value: ConfigValue;
  readonly message: string;
  readonly docs?: string;
  readonly severity?: Severity;
  accept?: (actual: unknown) => boolean;
  /** Recorded default value; does not establish safety without `defaultSafety`. */
  readonly documentedDefault?: ConfigValue;
  /** Only unconditional defaults may reduce severity; omitted means conditional. */
  readonly defaultSafety?: 'unconditional' | 'conditional';
  /**
   * Severity when an unconditional `documentedDefault` satisfies the requirement. Defaults
   * to `'info'` (advisory). Set `'off'` to silence the finding entirely.
   */
  readonly defaultSatisfiedSeverity?: Severity | 'off';
  readonly versionNote?: VersionNote;
}

export interface RequireConfigKeyOptions<Id extends string = string> {
  readonly id: Id;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly docs?: string;
  readonly projectTypes?: Rule['projectTypes'];
  /** Bindings keyed by PM. PMs absent from this map are treated as N/A. */
  readonly bindings: Partial<Record<PM, RequireConfigKeySpec>>;
  /** Return false to short-circuit `check` as N/A (e.g. private packages). */
  applies?: (ctx: RepoContext) => boolean;
}

export const overrideBindings = <Id extends string>(
  rule: Rule<Id>,
  overrides: Partial<Rule['bindings']>,
): Rule<Id> => ({ ...rule, bindings: { ...rule.bindings, ...overrides } });

const accepts = (spec: RequireConfigKeySpec, actual: unknown): boolean =>
  spec.accept ? spec.accept(actual) : actual === spec.value;

const checkKeyValue = (spec: RequireConfigKeySpec, config: ParsedConfig): CheckStatus => {
  const actual = getByPath(config, spec.keyPath);
  const isCoveredByUnconditionalDefault =
    actual === undefined &&
    spec.documentedDefault !== undefined &&
    spec.defaultSafety === 'unconditional' &&
    accepts(spec, spec.documentedDefault);

  if (!isCoveredByUnconditionalDefault && accepts(spec, actual)) return { state: 'ok' };

  const severity = isCoveredByUnconditionalDefault
    ? (spec.defaultSatisfiedSeverity ?? 'info')
    : undefined;
  if (severity === 'off') return { state: 'ok' };
  return {
    state: 'violation',
    actual,
    expected: spec.value,
    message: spec.message,
    ...(severity === undefined ? {} : { severity }),
    remediation: proposeChanges(config, [
      { file: spec.file, keyPath: spec.keyPath, op: 'setKey', value: spec.value },
    ]),
  };
};

const buildBinding = (
  spec: RequireConfigKeySpec,
  pm: PM,
  applies?: (ctx: RepoContext) => boolean,
): RuleBinding => ({
  check(ctx, config): CheckStatus {
    if (typeof applies !== 'undefined' && !applies(ctx)) {
      return { state: 'na' };
    }
    const status = checkKeyValue(spec, config);
    if (status.state !== 'violation') return status;
    // Public bindings can be checked directly, without evaluateBinding's proposal guard.
    return {
      ...status,
      remediation: guardRemediationAvailability(pm, ctx.pmVersion, status.remediation, [spec]),
    };
  },
  docs: spec.docs,
  file: spec.file,
  severity: spec.severity,
  versionNote: spec.versionNote,
});

/** Build a Rule from a per-PM table of {file, keyPath, value, message}. */
export const requireConfigKey = <const Id extends string>(
  options: RequireConfigKeyOptions<Id>,
): Rule<Id> => {
  const bindings: Partial<Record<PM, RuleBinding>> = {};
  for (const pm of PMS) {
    const spec = options.bindings[pm];
    if (spec === undefined) continue;
    if ('extraFix' in spec) {
      throw new TypeError('extraFix is no longer supported; use a custom binding.');
    }
    bindings[pm] = buildBinding(spec, pm, options.applies);
  }
  return {
    bindings,
    description: options.description,
    docs: options.docs,
    id: options.id,
    projectTypes: options.projectTypes,
    severity: options.severity,
    title: options.title,
  };
};
