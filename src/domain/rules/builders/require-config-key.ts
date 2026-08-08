import type {
  AutoRuleBinding,
  CheckStatus,
  ConfigFileRef,
  FixOp,
  Rule,
  VersionNote,
} from '../../entities/rule.ts';
import {
  type ConfigValue,
  type KeyAssignment,
  type KeyPath,
  getByPath,
} from '../../entities/config-value.ts';
import { type PM, PMS, type Severity } from '../../entities/pms.ts';
import type { RepoContext } from '../../ports/repo-context.ts';

type SetKeyOp = Extract<FixOp, { op: 'setKey' }>;
type First<Tp extends readonly unknown[]> = Tp extends readonly [infer Hd, ...unknown[]]
  ? Hd
  : never;
type GetByPathConfig = First<Parameters<typeof getByPath>>;

interface RequireConfigKeySpec {
  readonly file: ConfigFileRef;
  readonly keyPath: KeyPath;
  /** Value `fix` will write and (when no `accept` predicate is given) the value `check` expects. */
  readonly value: ConfigValue;
  readonly message: string;
  readonly docs?: string;
  readonly severity?: Severity;
  accept?: (actual: unknown) => boolean;
  /**
   * Extra key writes appended after the auto-generated one (e.g. clearing
   * save-prefix alongside save-exact on the same .npmrc). The target file
   * is implicitly `spec.file` — extras can't redirect to a different file
   * because `check` would then never validate them, leaving the fix ops
   * and `lint` permanently out of step. A rule that legitimately needs to write
   * across multiple files belongs in a hand-written binding (see
   * `disable-lifecycle-scripts` → `overrideBindings`).
   */
  readonly extraFix?: readonly KeyAssignment[];
  /**
   * PM-documented default for this key. When the user has not set the key
   * AND this default would satisfy `accept`/`value`, the finding is
   * downgraded to {@link defaultSatisfiedSeverity} (default `'info'`) — the
   * threat is mitigated by the PM but explicit pinning is still recommended.
   * - unset: no PM-default protection (legacy behaviour).
   *
   * A CONDITIONAL default (e.g. CI-only: pnpm `frozenLockfile`, aube
   * `preferFrozenLockfile`) may use this field, but the binding's `message`
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

export interface RequireConfigKeyOptions {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly docs?: string;
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
export const overrideBindings = (rule: Rule, overrides: Partial<Rule['bindings']>): Rule => ({
  ...rule,
  bindings: { ...rule.bindings, ...overrides },
});

const isDefaultOk = (spec: RequireConfigKeySpec): boolean => {
  if (spec.accept) {
    return spec.accept(spec.documentedDefault);
  }
  return spec.documentedDefault === spec.value;
};

const checkDocumentedDefault = (
  spec: RequireConfigKeySpec,
  actual: ReturnType<typeof getByPath>,
  message: string,
): CheckStatus | undefined => {
  if (typeof actual !== 'undefined' || typeof spec.documentedDefault === 'undefined') {
    return void 0;
  }
  if (!isDefaultOk(spec)) {
    return void 0;
  }
  const sev = spec.defaultSatisfiedSeverity ?? 'info';
  if (sev === 'off') {
    return { state: 'ok' };
  }
  return { actual, expected: spec.value, message, severity: sev, state: 'violation' };
};

// extraFix keys are unconditionally required by `check`; see D15.
const checkExtraFixes = (
  spec: RequireConfigKeySpec,
  config: GetByPathConfig,
  message: string,
): CheckStatus | undefined => {
  for (const extra of spec.extraFix ?? []) {
    const extraActual = getByPath(config, extra.keyPath);
    if (extraActual !== extra.value) {
      return { actual: extraActual, expected: extra.value, message, state: 'violation' };
    }
  }
  return void 0;
};

const checkPrimary = (
  spec: RequireConfigKeySpec,
  actual: ReturnType<typeof getByPath>,
  message: string,
): CheckStatus | undefined => {
  let primaryOk = actual === spec.value;
  if (spec.accept) {
    primaryOk = spec.accept(actual);
  }
  if (!primaryOk) {
    return { actual, expected: spec.value, message, state: 'violation' };
  }
  return void 0;
};

const checkKeyValue = (
  spec: RequireConfigKeySpec,
  config: GetByPathConfig,
  message: string,
): CheckStatus => {
  const actual = getByPath(config, spec.keyPath);
  // Ordering: advisory (documented-default) headline first, then unconditional
  // extras (D15). A primary-key violation short-circuits before extras; an
  // advisory still falls through so extras are validated even when the PM
  // default covers the primary key.
  const advisory = checkDocumentedDefault(spec, actual, message);
  if (typeof advisory === 'undefined') {
    const primary = checkPrimary(spec, actual, message);
    if (typeof primary !== 'undefined') {
      return primary;
    }
  }
  return checkExtraFixes(spec, config, message) ?? advisory ?? { state: 'ok' };
};

const buildBinding = (
  spec: RequireConfigKeySpec,
  applies?: (ctx: RepoContext) => boolean,
): AutoRuleBinding => ({
  check(ctx, config): CheckStatus {
    if (typeof applies !== 'undefined' && !applies(ctx)) {
      return { state: 'na' };
    }
    return checkKeyValue(spec, config, spec.message);
  },
  docs: spec.docs,
  file: spec.file,
  fix(): SetKeyOp[] {
    const ops: SetKeyOp[] = [
      { file: spec.file, keyPath: spec.keyPath, op: 'setKey', value: spec.value },
    ];
    for (const extra of spec.extraFix ?? []) {
      ops.push({ file: spec.file, keyPath: extra.keyPath, op: 'setKey', value: extra.value });
    }
    return ops;
  },
  fixKind: 'auto',
  severity: spec.severity,
  versionNote: spec.versionNote,
});

/** Build a Rule from a per-PM table of {file, keyPath, value, message}. */
export const requireConfigKey = (options: RequireConfigKeyOptions): Rule => {
  const bindings: Partial<Record<PM, AutoRuleBinding>> = {};
  for (const pm of PMS) {
    const spec = options.bindings[pm];
    if (typeof spec !== 'undefined') {
      bindings[pm] = buildBinding(spec, options.applies);
    }
  }
  return {
    bindings,
    description: options.description,
    docs: options.docs,
    id: options.id,
    severity: options.severity,
    title: options.title,
  };
};
