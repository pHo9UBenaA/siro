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
import { declaredPMVersion, isStableVersion } from '../domain/services/pm-versions.ts';
import { nodeFileSystem, resolveIn } from '../adapters/node-file-system.ts';
import { workspaceDirectories, workspacePatterns } from './workspaces.ts';

export interface LintOptions {
  readonly cwd: AbsPath;
  readonly fs?: FileSystem;
  readonly pm?: PM;
  /** Exact stable version for `pm`; overrides config.pmVersions and packageManager. */
  readonly pmVersion?: string;
  /** Also inspect declared workspace members' package.json publication settings. */
  readonly workspaces?: boolean;
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
  if (options.pmVersion !== undefined && (!options.pm || !isStableVersion(options.pmVersion))) {
    throw new UsageError(
      'pmVersion / --pm-version requires pm / --pm and an exact stable version such as 10.16.0.',
    );
  }
  if (options.workspaces !== undefined && typeof options.workspaces !== 'boolean') {
    throw new UsageError('workspaces must be a boolean.');
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
  const pmVersions = {
    ...declaredPMVersion(ctx.packageJson?.packageManager),
    ...config?.pmVersions,
    ...(options.pm && options.pmVersion ? { [options.pm]: options.pmVersion } : {}),
  };
  const fs = options.fs ?? nodeFileSystem;
  const members = options.workspaces
    ? pms.flatMap((pm) =>
        workspaceDirectories(ctx, fs, workspacePatterns(ctx, pm)).flatMap((directory) => {
          const root = resolveIn(ctx.root, directory);
          const manifest = resolveIn(root, asRelPath('package.json'));
          // Member inspection deliberately reads only its manifest, not a synthetic
          // merge of root and child installation settings or executable configs.
          const memberFs: FileSystem = {
            exists: (file) => file === manifest && fs.exists(file),
            readText: (file) => (file === manifest ? fs.readText(file) : undefined),
          };
          try {
            const memberCtx = createRepoContext(
              root,
              memberFs,
              options.projectType ?? config?.projectType,
            );
            return memberCtx.packageJson ? [{ directory, pm, ctx: memberCtx }] : [];
          } catch (error) {
            if (error instanceof ConfigError)
              throw new ConfigError(`${directory}/${error.message}`);
            throw error;
          }
        }),
      )
    : [];
  return {
    ctx,
    pms,
    pmVersions,
    members,
    ruleSet: configured.rules,
    severityOverrides: configured.severityOverrides,
    codecFor,
    reporters: config?.reporters ?? [],
  };
};

/** Reuse the existing manifest checks; installation policy remains rooted at cwd. */
export const runPreparedLint = (prepared: ReturnType<typeof prepareLint>): LintResult => {
  const result = runLint(prepared);
  const findings = [...result.findings];
  const summary = { ...result.summary };
  const memberRules = prepared.ruleSet.filter((rule) =>
    ['files-field', 'publish-access', 'unsupported-settings'].includes(rule.id),
  );
  for (const member of prepared.members) {
    const child = runLint({ ...prepared, ctx: member.ctx, pms: [member.pm], ruleSet: memberRules });
    for (const finding of child.findings) {
      findings.push({
        ...finding,
        file: `${member.directory}/${finding.file ?? 'package.json'}`,
        message: `${member.directory}: ${finding.message}`,
        remediation:
          finding.remediation?.kind === 'manual'
            ? {
                kind: 'manual',
                steps: [
                  `Work in ${member.directory} for this finding.`,
                  ...finding.remediation.steps,
                ],
              }
            : finding.remediation,
      });
    }
    for (const level of ['error', 'warn', 'info'] as const) summary[level] += child.summary[level];
  }
  return { findings, summary };
};

export const lint = (options: LintOptions): LintResult => runPreparedLint(prepareLint(options));
