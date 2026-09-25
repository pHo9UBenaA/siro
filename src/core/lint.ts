import type { LintDependencies } from './contracts/lint-dependencies.ts';
import type { BuiltinRuleId } from './rules/builtin-rules.ts';
import { collectWorkspaceMembers } from './workspaces/members.ts';
import { type AbsPath, asRelPath } from './contracts/paths.ts';
import type { FileSystem } from './contracts/file-system.ts';
import { type PM, isPM } from './contracts/pms.ts';
import { type ProjectType, isProjectType } from './contracts/project-type.ts';
import type { SiroConfig } from './siro-config.ts';
import type { LintResult } from './contracts/lint-result.ts';
import { UsageError, ConfigError } from './contracts/errors.ts';
import { applyConfig } from './apply-config.ts';
import { createConfigParser } from './parse-config-file.ts';
import { resolvePMs } from './resolve-pms.ts';
import { parseConfig } from './parse-siro-config.ts';
import { runLint } from './run-lint.ts';
import { declaredPMVersion, isStableVersion } from './pm-versions.ts';

export interface LintOptions {
  readonly cwd: AbsPath;
  readonly fs?: FileSystem;
  readonly pm?: PM;
  /** Exact stable version for `pm`; overrides config.pmVersions and packageManager. */
  readonly pmVersion?: string;
  /** Also inspect declared workspace members' publication settings. */
  readonly workspaces?: boolean;
  readonly projectType?: ProjectType;
  /** Explicit configuration; the library never imports files from the target repository. */
  readonly config?: SiroConfig;
}

/** Evaluate a repository without reporting or executing configuration files. */
export const prepareLint = (options: LintOptions, dependencies: LintDependencies) => {
  const { paths, codecFor, createRepoContext } = dependencies;
  if (!options || !paths.isAbsolute(options.cwd)) {
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
  const fs = options.fs === undefined ? dependencies.fileSystem : options.fs;
  const ctx = createRepoContext(options.cwd, fs, options.projectType ?? config?.projectType);
  const parseConfigFile = createConfigParser(codecFor, ctx);
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
  const configured = applyConfig(dependencies.rules, config);
  const pmVersions = {
    ...declaredPMVersion(ctx.packageJson?.packageManager),
    ...config?.pmVersions,
    ...(options.pm && options.pmVersion ? { [options.pm]: options.pmVersion } : {}),
  };
  const members = options.workspaces
    ? collectWorkspaceMembers(
        ctx,
        parseConfigFile,
        fs,
        pms,
        options.projectType ?? config?.projectType,
        dependencies,
      )
    : [];
  return {
    ctx,
    parseConfig: parseConfigFile,
    pms,
    pmVersions,
    members,
    ruleSet: configured.rules,
    severityOverrides: configured.severityOverrides,
    codecFor,
    reporters: config?.reporters ?? [],
  };
};

// Only these built-in publication checks apply to workspace members. Custom
// rules and installation policy remain rooted at cwd, even if they read a manifest.
const memberPublicationRuleIds: ReadonlySet<string> = new Set<BuiltinRuleId>([
  'files-field',
  'publish-access',
  'unsupported-settings',
]);

/** Reuse the existing manifest checks; installation policy remains rooted at cwd. */
export const runPreparedLint = (prepared: ReturnType<typeof prepareLint>): LintResult => {
  const result = runLint(prepared);
  const findings = [...result.findings];
  const summary = { ...result.summary };
  const memberRules = prepared.ruleSet.filter((rule) => memberPublicationRuleIds.has(rule.id));
  for (const member of prepared.members) {
    const child = runLint({
      ...prepared,
      ctx: member.ctx,
      parseConfig: member.parseConfig,
      pms: [member.pm],
      ruleSet: memberRules,
    });
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

export const lint = (options: LintOptions, dependencies: LintDependencies): LintResult =>
  runPreparedLint(prepareLint(options, dependencies));
