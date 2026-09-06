import {
  CODEC_KINDS,
  type CodecKind,
  type ConfigReadValue,
  type ConfigValue,
  type KeyPath,
  type ParsedConfig,
} from './config-value.ts';
import { PMS, type PM, type Severity, isPM, isSeverity } from './pms.ts';
import { type RelPath, isRelPath } from '../../shared/paths.ts';
import type { RuleContext } from '../ports/repo-context.ts';
import { type ProjectType, isProjectType } from './project-type.ts';
import { isPlainRecord } from '../../shared/records.ts';

export interface ConfigFileRef {
  readonly kind: CodecKind;
  readonly path: RelPath;
}

export interface SetKeyOperation {
  readonly op: 'setKey';
  readonly file: ConfigFileRef;
  readonly keyPath: KeyPath;
  readonly value: ConfigValue;
}

/** A check chooses one remedy for the state it observed. siro does not apply it. */
export type Remediation =
  | {
      readonly kind: 'automatic';
      readonly operations: readonly [SetKeyOperation, ...SetKeyOperation[]];
      readonly steps?: never;
    }
  | {
      readonly kind: 'manual';
      readonly steps: readonly [string, ...string[]];
      readonly operations?: never;
    };

export type CheckStatus =
  | { readonly state: 'ok' }
  | { readonly state: 'na' }
  | {
      readonly state: 'violation';
      readonly message: string;
      /** Override the primary file when the violation concerns another input. */
      readonly file?: RelPath;
      readonly expected?: ConfigValue;
      readonly actual?: ConfigReadValue;
      /** User configuration takes precedence over this per-result severity. */
      readonly severity?: Severity;
      readonly remediation?: Remediation;
    };

/** Display-only package-manager version metadata. */
export interface VersionNote {
  readonly configAvailableSince?: string;
  readonly defaultSafeSince?: string;
  readonly note?: string;
}

export interface RuleBinding {
  readonly file?: ConfigFileRef;
  readonly docs?: string;
  readonly severity?: Severity;
  readonly versionNote?: VersionNote;
  check: (ctx: RuleContext, config: ParsedConfig) => CheckStatus;
}

/** A package-manager-agnostic security intent, realized per PM via `bindings`. */
export interface Rule<Id extends string = string> {
  readonly id: Id;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly docs?: string;
  /** Project types this rule applies to; omission means both types. */
  readonly projectTypes?: readonly ProjectType[];
  /** Absence of a PM key means the rule does not apply (N/A) to that PM. */
  readonly bindings: Partial<Record<PM, RuleBinding>>;
}

export const defineRule = <const Id extends string>(rule: Rule<Id>): Rule<Id> => rule;

const isOptionalString = (value: unknown): boolean =>
  typeof value === 'undefined' || typeof value === 'string';

const CONFIG_FILE_KINDS: ReadonlySet<string> = new Set(CODEC_KINDS);

const isConfigFileRefShape = (value: unknown): value is ConfigFileRef => {
  if (!isPlainRecord(value) || typeof value.kind !== 'string' || !isRelPath(value.path)) {
    return false;
  }
  return CONFIG_FILE_KINDS.has(value.kind);
};

const isConfigValueShape = (value: unknown): value is ConfigValue =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const isDenseStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && Array.from(value).every((item) => typeof item === 'string');

export const isCheckStatusShape = (value: unknown): value is CheckStatus => {
  if (!isPlainRecord(value)) {
    return false;
  }
  if (value.state === 'ok' || value.state === 'na') {
    return true;
  }
  return (
    value.state === 'violation' &&
    typeof value.message === 'string' &&
    (value.file === undefined || isRelPath(value.file)) &&
    (value.expected === undefined || isConfigValueShape(value.expected)) &&
    (value.severity === undefined ||
      (typeof value.severity === 'string' && isSeverity(value.severity))) &&
    !('manualSteps' in value) &&
    !('fix' in value) &&
    !('fixable' in value) &&
    (value.remediation === undefined || isRemediationShape(value.remediation))
  );
};

const isSetKeyOperation = (value: unknown): value is SetKeyOperation =>
  isPlainRecord(value) &&
  value.op === 'setKey' &&
  isConfigFileRefShape(value.file) &&
  isDenseStringArray(value.keyPath) &&
  value.keyPath.length > 0 &&
  isConfigValueShape(value.value);

const isRemediationShape = (value: unknown): value is Remediation => {
  if (!isPlainRecord(value)) return false;
  if (value.kind === 'manual') {
    return !('operations' in value) && isDenseStringArray(value.steps) && value.steps.length > 0;
  }
  return (
    value.kind === 'automatic' &&
    !('steps' in value) &&
    Array.isArray(value.operations) &&
    value.operations.length > 0 &&
    Array.from(value.operations).every(isSetKeyOperation)
  );
};

const isVersionNoteShape = (value: unknown): value is VersionNote | undefined =>
  typeof value === 'undefined' ||
  (isPlainRecord(value) &&
    isOptionalString(value.configAvailableSince) &&
    isOptionalString(value.defaultSafeSince) &&
    isOptionalString(value.note));

const isRuleBindingShape = (value: unknown): value is RuleBinding => {
  if (!isPlainRecord(value)) {
    return false;
  }
  return (
    (value.file === undefined || isConfigFileRefShape(value.file)) &&
    !('fix' in value) &&
    !('fixKind' in value) &&
    !('fileGlob' in value) &&
    isOptionalString(value.docs) &&
    (typeof value.severity === 'undefined' ||
      (typeof value.severity === 'string' && isSeverity(value.severity))) &&
    isVersionNoteShape(value.versionNote) &&
    typeof value.check === 'function'
  );
};

const isBindingsShape = (value: unknown): value is Rule['bindings'] =>
  isPlainRecord(value) &&
  Object.keys(value).every(isPM) &&
  PMS.every((pm) => value[pm] === undefined || isRuleBindingShape(value[pm]));

const isProjectTypeValue = (value: unknown): value is ProjectType =>
  typeof value === 'string' && isProjectType(value);

const isProjectTypesShape = (value: unknown): value is readonly ProjectType[] | undefined =>
  typeof value === 'undefined' ||
  (Array.isArray(value) &&
    Array.from(value).every((projectType) => isProjectTypeValue(projectType)));

export const isRuleShape = (value: unknown): value is Rule => {
  if (!isPlainRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.severity === 'string' &&
    isSeverity(value.severity) &&
    isOptionalString(value.docs) &&
    isProjectTypesShape(value.projectTypes) &&
    isBindingsShape(value.bindings)
  );
};
