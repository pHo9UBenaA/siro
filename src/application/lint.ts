import { type AbsPath, isAbsPath, asRelPath } from '../shared/paths.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import { type PM, isPM } from '../domain/entities/pms.ts';
import { type ProjectType, isProjectType } from '../domain/entities/project-type.ts';
import type { SiroConfig } from '../domain/entities/siro-config.ts';
import type { LintResult } from '../domain/entities/lint-result.ts';
import { UsageError, ConfigError } from '../shared/errors.ts';
import { createRepoContext } from '../adapters/repo-context.ts';
import { codecFor } from '../adapters/codecs/store.ts';
import { rules } from '../domain/builtin-rules.ts';
import { applyConfig } from '../domain/services/apply-config.ts';
import { resolvePMs } from '../domain/services/resolve-pms.ts';
import { parseConfig } from './config.ts';
import { runLint } from './run-lint.ts';

export interface LintOptions {
  readonly cwd: AbsPath;
  readonly fs?: FileSystem;
  readonly pm?: PM;
  readonly projectType?: ProjectType;
  /** Explicit configuration; the library never imports files from the target repository. */
  readonly config?: SiroConfig;
}

/** Evaluate a repository without reporting or executing configuration files. */
export const prepareLint = (options: LintOptions) => {
  if (!options || !isAbsPath(options.cwd)) {
    throw new UsageError('cwd must be an absolute filesystem path.');
  }
  if ('customRules' in options || 'reporters' in options) {
    throw new UsageError('Pass customRules and reporters inside the config option.');
  }
  if (options.pm !== undefined && !isPM(options.pm)) {
    throw new UsageError(`Unknown package manager: ${String(options.pm)}`);
  }
  if (options.projectType !== undefined && !isProjectType(options.projectType)) {
    throw new UsageError(`Unknown project type: ${String(options.projectType)}`);
  }
  const config = options.config === undefined ? undefined : parseConfig(options.config);
  const ctx = createRepoContext(
    options.cwd,
    options.fs,
    options.projectType ?? config?.projectType,
  );
  const pms = resolvePMs(ctx, { allowed: config?.pms, pmOverride: options.pm });
  if (
    pms.includes('deno') &&
    !ctx.exists(asRelPath('deno.json')) &&
    ctx.exists(asRelPath('deno.jsonc'))
  ) {
    throw new ConfigError(
      'deno.jsonc is not supported. siro currently reads strict JSON from deno.json only.',
    );
  }
  const configured = applyConfig(rules, config);
  return {
    ctx,
    pms,
    ruleSet: configured.rules,
    severityOverrides: configured.severityOverrides,
    codecFor,
    reporters: config?.reporters ?? [],
  };
};

export const lint = (options: LintOptions): LintResult => runLint(prepareLint(options));
