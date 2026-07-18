import type {
  AutoRuleBinding,
  CheckStatus,
  ConfigFileRef,
  FixOp,
  Rule,
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

/**
 * Display-only metadata for a binding. siro itself is intentionally
 * version-agnostic (we never branch on the user's actual PM version) — these
 * fields exist so the rendered message can still tell the reader *when* a key
 * appeared and *when* the PM started shipping a safe default. They MUST NOT
 * be consulted by any code path that decides severity or applicability.
 */
export interface VersionNote {
  /** PM version that first shipped this config key (e.g. `'pnpm 10.16.0'`). */
  readonly configAvailableSince?: string;
  /** PM version whose built-in default first satisfies the rule (e.g. `'pnpm 11.0.0 (1440 minutes)'`). */
  readonly defaultSafeSince?: string;
  /** Free-form trailing note rendered last (e.g. `'replaces auto-install-peers'`). */
  readonly note?: string;
}

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

/**
 * Compose `message` with the structured suffix derived from {@link VersionNote}.
 * Exported for the two hand-written bindings that can't be expressed via
 * {@link requireConfigKey}: the pnpm slot of `disable-lifecycle-scripts`
 * (two-key gate+bypass) and `bun-security-scanner` (advisory shape).
 * New rules should grow `requireConfigKey` rather than reach for this
 * helper — every additional caller raises the cost of evolving the suffix
 * format.
 */
const buildVersionNoteParts = (versionNote: VersionNote): readonly string[] => {
  const parts: string[] = [];
  if (typeof versionNote.configAvailableSince !== 'undefined') {
    parts.push(`available since ${versionNote.configAvailableSince}`);
  }
  if (typeof versionNote.defaultSafeSince !== 'undefined') {
    parts.push(`default safe since ${versionNote.defaultSafeSince}`);
  }
  if (typeof versionNote.note !== 'undefined') {
    parts.push(versionNote.note);
  }
  return parts;
};

export const renderVersionNoteMessage = (
  message: string,
  versionNote: VersionNote | undefined,
): string => {
  if (typeof versionNote === 'undefined') {
    return message;
  }
  const parts = buildVersionNoteParts(versionNote);
  // Why not throw on empty? An empty VersionNote is harmless documentation
  // noise; treating it as a bug would force callers to either omit the field
  // or fill it, and the omit-the-field path is already the natural default.
  const EMPTY = 0;
  if (parts.length === EMPTY) {
    return message;
  }
  return `${message} (${parts.join('; ')})`;
};

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
    const message = renderVersionNoteMessage(spec.message, spec.versionNote);
    return checkKeyValue(spec, config, message);
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
