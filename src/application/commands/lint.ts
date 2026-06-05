import type { PM, Severity } from '../../domain/entities/pms.ts';
import { type Reporter, isReporterShape } from '../../domain/ports/reporter.ts';
import { exitCodeForLint, filterBySeverity } from '../../domain/services/filter.ts';
import type { AbsPath } from '../../shared/paths.ts';
import type { FileSystem } from '../../domain/ports/file-system.ts';
import type { IO } from '../../domain/ports/io.ts';
import type { RepoContext } from '../../domain/ports/repo-context.ts';
import type { Rule } from '../../domain/entities/rule.ts';
import { UsageError } from '../../shared/errors.ts';
import { codecFor } from '../../adapters/codecs/store.ts';
import { createRegistry } from '../../adapters/reporters/registry.ts';
import { prepareRun } from '../prepare-context.ts';
import { runLint } from '../run-lint.ts';

export interface LintOptions {
  /**
   * Absolute repo root. Callers are responsible for resolving any relative
   * path before branding it; siro's CLI does this in `cli.ts`. Keeping the
   * brand here lets the application layer stay free of `node:path`.
   */
  cwd: AbsPath;
  /** Restrict to a single PM; otherwise PMs are auto-detected. */
  pm?: PM;
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
   * is loaded by jiti from the REAL disk — only the config's existence is probed
   * through this FS. A config that lives solely in an injected FS won't load.
   */
  fs?: FileSystem;
}

const resolveReporter = (
  value: LintOptions['reporter'],
  registry: ReturnType<typeof createRegistry>,
): Reporter | undefined => {
  if (typeof value === 'undefined') {
    return registry.get('pretty');
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
  for (const rep of reporters ?? []) {
    if (!isReporterShape(rep)) {
      throw new UsageError(
        "A reporter in 'reporters' needs a string 'name' and a 'format' function.",
      );
    }
  }
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
export const lintCommand = (options: LintOptions, io: IO): Promise<number> =>
  prepareRun({
    customRules: options.customRules,
    cwd: options.cwd,
    fs: options.fs,
    pm: options.pm,
  }).then(({ userConfig, ctx, pms, ruleSet }) => {
    validateEmbedderReporters(options.reporters);
    let configReporters: readonly Reporter[] = [];
    if (userConfig && userConfig.reporters) {
      configReporters = userConfig.reporters;
    }
    const registry = createRegistry([...(options.reporters ?? []), ...configReporters]);
    const reporter = resolveAndValidateReporter(options.reporter, registry);
    return formatAndExit({ ctx, io, options, pms, reporter, ruleSet });
  });
