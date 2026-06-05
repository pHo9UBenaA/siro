import type {
  CodecKind,
  ConfigReadValue,
  ConfigValue,
  KeyPath,
  ParsedConfig,
} from './config-value.ts';
import type { PM, Severity } from './pms.ts';
import type { RelPath } from '../../shared/paths.ts';
import type { RepoContext } from '../ports/repo-context.ts';

/**
 * What a rule binding points at on disk: a parsed config file or an existence
 * check (e.g. "a lockfile is committed"). `path` is a branded `RelPath` minted
 * once at the ref's definition (CONFIG_FILES), so the readText boundary is
 * type-checked and a stray absolute path can't slip in as a string.
 */
export type ConfigFileRef =
  | { readonly kind: CodecKind; readonly path: RelPath }
  | { readonly kind: 'fileGlob'; readonly path: RelPath };

/** Result of evaluating a single rule binding against a repo. */
export type CheckStatus =
  | { readonly state: 'ok' }
  | {
      readonly state: 'violation';
      readonly message: string;
      readonly expected?: ConfigValue;
      readonly actual?: ConfigReadValue;
      /**
       * Dynamic severity for this specific violation, overriding both
       * {@link AutoRuleBinding.severity} and {@link Rule.severity}. Lets a
       * `check` distinguish "unset but PM-default safe" (advisory) from
       * "explicitly weakened" (full severity). A user `rules` override in
       * config still wins (see `applyConfig`).
       */
      readonly severity?: Severity;
      /**
       * Manual remediation steps surfaced verbatim on the finding. Lets a
       * `check` signal "the setKey fix ops cannot resolve this state; the
       * user has to intervene" — e.g. when an explicit user override would
       * have to be deleted first. When non-empty, `Finding.fix` is emitted
       * empty so an external fixer never writes ops the user's existing
       * config would defeat.
       */
      readonly manualSteps?: readonly string[];
    }
  | { readonly state: 'na' };

/** A remediation step produced by a rule's `fix`. */
export type FixOp =
  | {
      readonly op: 'setKey';
      readonly file: ConfigFileRef;
      readonly keyPath: KeyPath;
      readonly value: ConfigValue;
    }
  | { readonly op: 'ensureFileTracked'; readonly file: ConfigFileRef; readonly message: string }
  | { readonly op: 'note'; readonly message: string; readonly file?: ConfigFileRef };

/**
 * - `auto`: `fix` produces setKey ops an external fixer can apply
 *   mechanically (surfaced via `Finding.fix`; see docs/json-output.md).
 * - `advisory`: `fix` only produces notes/ensureFileTracked hints.
 */
export type FixKind = 'auto' | 'advisory';

type SetKeyOp = Extract<FixOp, { op: 'setKey' }>;
type AdvisoryOp = Extract<FixOp, { op: 'note' | 'ensureFileTracked' }>;

export interface AutoRuleBinding {
  readonly file: ConfigFileRef;
  readonly fixKind: 'auto';
  /** Official package-manager doc URL for the setting this binding writes. */
  readonly docs?: string;
  /**
   * Per-binding severity. When set, it shadows {@link Rule.severity} for this
   * PM only — used when a package manager's safe default already mitigates
   * the threat (so the binding is informational) while another PM with the
   * same rule still warrants the rule-wide level. A user config `rules`
   * override always wins over both.
   */
  readonly severity?: Severity;
  check: (ctx: RepoContext, config: ParsedConfig) => CheckStatus;
  fix: (ctx: RepoContext) => readonly SetKeyOp[];
}

export interface AdvisoryRuleBinding {
  readonly file: ConfigFileRef;
  readonly fixKind: 'advisory';
  /** Official package-manager doc URL for the setting this binding describes. */
  readonly docs?: string;
  /** See {@link AutoRuleBinding.severity}. */
  readonly severity?: Severity;
  check: (ctx: RepoContext, config: ParsedConfig) => CheckStatus;
  fix: (ctx: RepoContext) => readonly AdvisoryOp[];
}

export type RuleBinding = AutoRuleBinding | AdvisoryRuleBinding;

/** A package-manager-agnostic security intent, realized per PM via `bindings`. */
export interface Rule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly docs?: string;
  /** Absence of a PM key means the rule does not apply (N/A) to that PM. */
  readonly bindings: Partial<Record<PM, RuleBinding>>;
}
