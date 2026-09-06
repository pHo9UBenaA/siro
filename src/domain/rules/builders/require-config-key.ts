import { proposeChanges } from '../remediation.ts';
import type {
  RuleBinding,
  CheckStatus,
  Rule,
  VersionNote,
  ConfigFileRef,
} from '../../entities/rule.ts';
import {
  type ConfigValue,
  type KeyPath,
  type ParsedConfig,
  getByPath,
} from '../../entities/config-value.ts';
import { type PM, PMS, type Severity } from '../../entities/pms.ts';
import type { RepoContext } from '../../ports/repo-context.ts';

interface RequireConfigKeySpec {
  readonly file: ConfigFileRef;
  readonly keyPath: KeyPath;
  /** Expected value and proposed replacement; `accept` may allow other values. */
  readonly value: ConfigValue;
  readonly message: string;
  readonly docs?: string;
  readonly severity?: Severity;
  accept?: (actual: unknown) => boolean;
  /**
   * An omitted value that is safe across every supported version and target
   * environment emits info. Version-dependent defaults retain full severity.
   */
  readonly documentedDefault?: ConfigValue;
  /**
   * Severity used when `documentedDefault` satisfies the requirement. Defaults
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
  const coveredByDefault =
    actual === undefined &&
    spec.documentedDefault !== undefined &&
    spec.versionNote?.defaultSafeSince === undefined &&
    accepts(spec, spec.documentedDefault);

  if (!coveredByDefault && accepts(spec, actual)) return { state: 'ok' };
  const severity = coveredByDefault ? (spec.defaultSatisfiedSeverity ?? 'info') : undefined;
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
  applies?: (ctx: RepoContext) => boolean,
): RuleBinding => ({
  check(ctx, config): CheckStatus {
    if (typeof applies !== 'undefined' && !applies(ctx)) {
      return { state: 'na' };
    }
    return checkKeyValue(spec, config);
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
    if (typeof spec !== 'undefined') {
      if ('extraFix' in spec) {
        throw new TypeError('extraFix is no longer supported; use a custom binding.');
      }
      bindings[pm] = buildBinding(spec, options.applies);
    }
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
