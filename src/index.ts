/**
 * Public API for embedders. The CLI is layered on top of this surface, so
 * anything siro itself can do is reachable from the library entry point.
 */

export { nodeFileSystem } from './adapters/node-file-system.ts';
export { nodeIO } from './adapters/node-io.ts';
export {
  BUILTIN_REPORTER_NAMES,
  type BuiltinReporterName,
  createRegistry,
  githubReporter,
  jsonReporter,
  prettyReporter,
  type ReporterRegistry,
} from './adapters/reporters/registry.ts';
export { type LintOptions, lintCommand } from './application/commands/lint.ts';
export { CONFIG_FILES } from './domain/entities/config-files.ts';
export type {
  ConfigScalar,
  ConfigValue,
  KeyAssignment,
  KeyPath,
  ParsedConfig,
} from './domain/entities/config-value.ts';
export { getByPath } from './domain/entities/config-value.ts';
export type { ConfigReadValue, Finding, LintResult } from './domain/entities/lint-result.ts';
export {
  isPM,
  isSeverity,
  type PM,
  PMS,
  SEVERITIES,
  type Severity,
} from './domain/entities/pms.ts';
export type {
  AdvisoryRuleBinding,
  AutoRuleBinding,
  CheckStatus,
  ConfigFileRef,
  FixKind,
  FixOp,
  Rule,
  RuleBinding,
} from './domain/entities/rule.ts';
export { PM_SIGNALS, type PMSignals } from './domain/entities/signals.ts';
export { defineConfig, type RuleSetting, type SiroConfig } from './domain/entities/siro-config.ts';
export type { CodecFor, ConfigCodec } from './domain/ports/config-codec.ts';
export type { FileSystem } from './domain/ports/file-system.ts';
export type { IO } from './domain/ports/io.ts';
export type { RepoContext } from './domain/ports/repo-context.ts';
export { isReporterShape, type Reporter } from './domain/ports/reporter.ts';
export {
  overrideBindings,
  type RequireConfigKeyOptions,
  renderVersionNoteMessage,
  requireConfigKey,
  type VersionNote,
} from './domain/rules/builders/require-config-key.ts';
export type { PackageJson } from './domain/schemas/package-json.ts';
export { detectPMs } from './domain/services/detect-pms.ts';
export { exitCodeForLint, filterBySeverity } from './domain/services/filter.ts';
export { ConfigError, SiroError, UsageError, wrapCodecError } from './shared/errors.ts';
export { type AbsPath, asAbsPath, asRelPath, type RelPath } from './shared/paths.ts';
export { version } from './version.ts';
