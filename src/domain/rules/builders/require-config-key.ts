import type {
  AutoRuleBinding,
  CheckStatus,
  FixOp,
  Rule,
  VersionNote,
  WritableConfigFileRef,
} from '../../entities/rule.ts';
import {
  type ConfigValue,
  type KeyPath,
  type ParsedConfig,
  getByPath,
} from '../../entities/config-value.ts';
import { type PM, PMS, type Severity } from '../../entities/pms.ts';
import type { RepoContext } from '../../ports/repo-context.ts';

type SetKeyOp = Extract<FixOp, { op: 'setKey' }>;
interface RequireConfigKeySpec {
  readonly file: WritableConfigFileRef;
  readonly keyPath: KeyPath;
  /** Value `fix` will write and (when no `accept` predicate is given) the value `check` expects. */
  readonly value: ConfigValue;
  readonly message: string;
  readonly docs?: string;
  readonly severity?: Severity;
  accept?: (actual: unknown) => boolean;
  /**
   * PM-documented default for this key. When the user has not set the key
   * AND this default would satisfy `accept`/`value`, the finding is
   * downgraded to {@link defaultSatisfiedSeverity} (default `'info'`) — the
   * threat is mitigated by the PM but explicit pinning is still recommended.
   * - unset: no PM-default protection (legacy behaviour).
   *
   * A CONDITIONAL default (e.g. CI-only: pnpm `frozenLockfile`) may use this field, but the binding's `message`
   * MUST name the condition — the downgrade then reads "covered where it
   * matters most", not "covered unconditionally".
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

/**
 * Replace one or more bindings on an existing rule, returning a fresh Rule
 * object. Used by rules whose shape outgrows {@link requireConfigKey} for a
 * subset of PMs — they build the simple slots via the builder, then splice
 * the hand-written bindings in via this helper rather than rebuilding from
 * scratch or mutating the source rule.
 */
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
    accepts(spec, spec.documentedDefault);

  if (!coveredByDefault && !accepts(spec, actual)) {
    return { actual, expected: spec.value, message: spec.message, state: 'violation' };
  }

  if (coveredByDefault) {
    const severity = spec.defaultSatisfiedSeverity ?? 'info';
    if (severity !== 'off') {
      return { actual, expected: spec.value, message: spec.message, severity, state: 'violation' };
    }
  }
  return { state: 'ok' };
};

const buildBinding = (
  spec: RequireConfigKeySpec,
  applies?: (ctx: RepoContext) => boolean,
): AutoRuleBinding => ({
  check(ctx, config): CheckStatus {
    if (typeof applies !== 'undefined' && !applies(ctx)) {
      return { state: 'na' };
    }
    return checkKeyValue(spec, config);
  },
  docs: spec.docs,
  file: spec.file,
  fix(): SetKeyOp[] {
    return [{ file: spec.file, keyPath: spec.keyPath, op: 'setKey', value: spec.value }];
  },
  fixKind: 'auto',
  severity: spec.severity,
  versionNote: spec.versionNote,
});

/** Build a Rule from a per-PM table of {file, keyPath, value, message}. */
export const requireConfigKey = <const Id extends string>(
  options: RequireConfigKeyOptions<Id>,
): Rule<Id> => {
  const bindings: Partial<Record<PM, AutoRuleBinding>> = {};
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
