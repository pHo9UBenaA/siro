export { lint, type LintOptions } from './application/lint.ts';
export { loadConfig } from './adapters/config-loader.ts';
export { nodeFileSystem } from './adapters/node-file-system.ts';
export { nodeIO } from './adapters/node-io.ts';
export {
  BUILTIN_REPORTER_NAMES,
  type BuiltinReporterName,
  githubReporter,
  jsonReporter,
  prettyReporter,
} from './adapters/reporters/registry.ts';
export { type LintCommandOptions, lintCommand } from './application/commands/lint.ts';
export { CONFIG_FILES } from './domain/entities/config-files.ts';
export type { ConfigValue, KeyPath, ParsedConfig } from './domain/entities/config-value.ts';
export { getByPath } from './domain/entities/config-value.ts';
export type { ConfigReadValue, Finding, LintResult } from './domain/entities/lint-result.ts';
export { type ProjectType, PROJECT_TYPES } from './domain/entities/project-type.ts';
export {
  isPM,
  isSeverity,
  type PM,
  PMS,
  SEVERITIES,
  type Severity,
} from './domain/entities/pms.ts';
export { defineRule } from './domain/entities/rule.ts';
export type {
  CheckStatus,
  ConfigFileRef,
  Remediation,
  SetKeyOperation,
  Rule,
  RuleBinding,
  VersionNote,
} from './domain/entities/rule.ts';
export { defineConfig, type RuleSetting, type SiroConfig } from './domain/entities/siro-config.ts';
export type { FileSystem } from './domain/ports/file-system.ts';
export type { IO } from './domain/ports/io.ts';
export type { RepoContext } from './domain/ports/repo-context.ts';
export type { Reporter } from './domain/ports/reporter.ts';
export {
  overrideBindings,
  type RequireConfigKeyOptions,
  requireConfigKey,
} from './domain/rules/builders/require-config-key.ts';
export { ConfigError, SiroError, UsageError } from './shared/errors.ts';
export { type AbsPath, asAbsPath, asRelPath, type RelPath } from './shared/paths.ts';
export { version } from './version.ts';
