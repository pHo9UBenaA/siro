export { lint, lintCommand, type LintOptions, type LintCommandOptions } from './runtime.ts';
export { version } from './version.ts';

export { loadConfig } from './load-config.ts';
export { defineConfig, type RuleSetting, type SiroConfig } from './core/siro-config.ts';
export { CONFIG_FILES } from './core/config-files.ts';
export {
  getByPath,
  type ConfigValue,
  type KeyPath,
  type ParsedConfig,
} from './core/contracts/config-value.ts';
export type { ConfigFileRef } from './core/contracts/config-file-ref.ts';
export type { InstallationRootInput } from './core/inspection-options.ts';

export {
  defineRule,
  type CheckStatus,
  type ViolationStatus,
  type Remediation,
  type SetKeyOperation,
  type Rule,
  type RuleBinding,
  type VersionNote,
} from './core/contracts/rule.ts';
export {
  overrideBindings,
  type RequireConfigKeyOptions,
  type RequireConfigKeySpec,
  requireConfigKey,
} from './core/rules/builders/require-config-key.ts';
export type { RepoContext, RuleContext } from './core/contracts/repo-context.ts';
export { type ProjectType, PROJECT_TYPES } from './core/contracts/project-type.ts';
export { isPM, isSeverity, type PM, PMS, SEVERITIES, type Severity } from './core/contracts/pms.ts';

export { nodeFileSystem } from './adapters/node-file-system.ts';
export type { FileSystem } from './core/contracts/file-system.ts';
export { nodeIO } from './adapters/node-io.ts';
export type { IO } from './core/contracts/io.ts';
export type { Reporter, ReportContext } from './core/contracts/reporter.ts';
export {
  BUILTIN_REPORTER_NAMES,
  type BuiltinReporterName,
  githubReporter,
  jsonReporter,
  prettyReporter,
} from './adapters/reporters/registry.ts';

export type {
  Inspection,
  PolicyTarget,
  ConfigReadValue,
  Finding,
  LintResult,
} from './core/contracts/lint-result.ts';
export { ConfigError, SiroError, UsageError } from './core/contracts/errors.ts';
export { type AbsPath, asRelPath, type RelPath } from './core/contracts/paths.ts';
export { asAbsPath } from './adapters/node-paths.ts';
export { DEFAULT_SCAN_LIMITS, type ScanLimits } from './core/contracts/scan-limits.ts';
