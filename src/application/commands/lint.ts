import {
  type PM,
  PMS,
  SEVERITIES,
  type Severity,
  isPM,
  isSeverity,
} from '../../domain/entities/pms.ts';
import { type Reporter, isReporterShape } from '../../domain/ports/reporter.ts';
import { exitCodeForLint, filterBySeverity } from '../../domain/services/filter.ts';
import type { AbsPath } from '../../shared/paths.ts';
import type { FileSystem } from '../../domain/ports/file-system.ts';
import type { IO } from '../../domain/ports/io.ts';
import type { RepoContext } from '../../domain/ports/repo-context.ts';
import { type Rule, isRuleShape } from '../../domain/entities/rule.ts';
import { UsageError } from '../../shared/errors.ts';
import { codecFor } from '../../adapters/codecs/store.ts';
import { DEFAULT_REPORTER_NAME, createRegistry } from '../../adapters/reporters/registry.ts';
import { prepareRun } from '../prepare-context.ts';
import { runLint } from '../run-lint.ts';
import {
  PROJECT_TYPES,
  type ProjectType,
  isProjectType,
} from '../../domain/entities/project-type.ts';

export interface LintOptions {
  /**
   * Absolute repo root. Callers are responsible for resolving any relative
   * path before branding it; siro's CLI does this in `cli.ts`. Keeping the
   * brand here lets the application layer stay free of `node:path`.
   */
  cwd: AbsPath;
  /** Restrict to a single PM; otherwise PMs are auto-detected. */
  pm?: PM;
  /** Select application or published-package policy; otherwise infer it. */
  projectType?: ProjectType;
  /** Reporter name or instance; defaults to `pretty`. */
  reporter?: string | Reporter;
  /** Extra reporters to make available by name (merged with the user config). */
  reporters?: readonly Reporter[];
  /**
   * Programmatic custom rules to evaluate alongside the builtins and any
   * `customRules` from the user config. Mirrors `SiroConfig.customRules`
   * but is supplied at the call site, so embedders can compose rulesets
   * without writing a config file. Ids must be unique across builtins,
   * config-supplied custom rules, and this list — collisions throw a
   * `ConfigError` (exit 2), matching how `loadConfig` rejects them.
   */
  customRules?: readonly Rule[];
  /** Show (and fail on) findings at or above this severity. */
  severity?: Severity;
  /**
   * Inject a non-default FS (e.g. memfs in tests). Caveat: `siro.config.{ts,mjs,js}`
   * is imported from the REAL disk — only the config's existence is probed
   * through this FS. A config that lives solely in an injected FS won't load.
   */
  fs?: FileSystem;
}

const resolveReporter = (
  value: LintOptions['reporter'],
  registry: ReturnType<typeof createRegistry>,
): Reporter | undefined => {
  if (typeof value === 'undefined') {
    return registry.get(DEFAULT_REPORTER_NAME);
  }
  if (typeof value === 'string') {
    return registry.get(value);
  }
  // An object reporter bypasses the registry (returned verbatim), so this is
  // the only place its shape is checked on the CLI/programmatic path.
  if (!isReporterShape(value)) {
    throw new UsageError("The 'reporter' option must be a name or a { name, format } object.");
  }
  return value;
};

const validateEmbedderReporters = (reporters: readonly Reporter[] | undefined): void => {
  // Validate embedder-supplied reporters at the CLI/programmatic boundary so a
  // malformed one is a UsageError, not a TypeError from `format` later. (Config
  // reporters are already shape-checked in loadConfig → ConfigError.)
  if (typeof reporters !== 'undefined' && !Array.isArray(reporters)) {
    throw new UsageError("The 'reporters' option must be an array of reporter objects.");
  }
  for (const rep of reporters ?? []) {
    if (!isReporterShape(rep)) {
      throw new UsageError(
        "A reporter in 'reporters' needs a string 'name' and a 'format' function.",
      );
    }
  }
};

const validateSelection = (
  value: unknown,
  isValid: (candidate: string) => boolean,
  errorMessage: string,
): void => {
  if (typeof value !== 'undefined' && (typeof value !== 'string' || !isValid(value))) {
    throw new UsageError(errorMessage);
  }
};

const validateCustomRules = (customRules: readonly Rule[] | undefined): void => {
  if (
    typeof customRules !== 'undefined' &&
    (!Array.isArray(customRules) || !customRules.every((rule) => isRuleShape(rule)))
  ) {
    throw new UsageError("The 'customRules' option must contain structurally valid rules.");
  }
};

const validateLintOptions = (options: LintOptions): void => {
  validateCustomRules(options.customRules);
  validateSelection(
    options.projectType,
    isProjectType,
    `Unknown project type: ${String(options.projectType)} (expected ${PROJECT_TYPES.join('|')})`,
  );
  validateSelection(
    options.pm,
    isPM,
    `Unknown package manager: ${String(options.pm)} (expected one of: ${PMS.join(', ')})`,
  );
  validateSelection(
    options.severity,
    isSeverity,
    `Invalid severity: ${String(options.severity)} (expected ${SEVERITIES.join('|')})`,
  );
};

const resolveAndValidateReporter = (
  value: LintOptions['reporter'],
  registry: ReturnType<typeof createRegistry>,
): Reporter => {
  const reporter = resolveReporter(value, registry);
  if (typeof reporter === 'undefined') {
    throw new UsageError(
      `Unknown reporter: ${String(value)} (available: ${registry.list().join(', ')})`,
    );
  }
  return reporter;
};

interface FormatAndExitArgs {
  readonly options: LintOptions;
  readonly reporter: Reporter;
  readonly ruleSet: readonly Rule[];
  readonly ctx: RepoContext;
  readonly pms: readonly PM[];
  readonly io: IO;
}

const formatAndExit = (args: FormatAndExitArgs): number => {
  const result = runLint({ codecFor, ctx: args.ctx, pms: args.pms, ruleSet: args.ruleSet });
  const displayThreshold: Severity = args.options.severity ?? 'info';
  const failThreshold: Severity = args.options.severity ?? 'error';
  args.reporter.format(filterBySeverity(result, displayThreshold), args.io);
  return exitCodeForLint(result, failThreshold);
};

/** `siro lint`: detect PMs, evaluate rules, report findings. */
export const lintCommand = async (options: LintOptions, io: IO): Promise<number> => {
  validateLintOptions(options);
  const { userConfig, ctx, pms, ruleSet } = await prepareRun({
    customRules: options.customRules,
    cwd: options.cwd,
    fs: options.fs,
    pm: options.pm,
    projectType: options.projectType,
  });
  validateEmbedderReporters(options.reporters);
  const configReporters = userConfig?.reporters ?? [];
  const registry = createRegistry([...(options.reporters ?? []), ...configReporters]);
  const reporter = resolveAndValidateReporter(options.reporter, registry);
  return formatAndExit({ ctx, io, options, pms, reporter, ruleSet });
};
