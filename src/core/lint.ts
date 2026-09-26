import type { LintDependencies } from './contracts/lint-dependencies.ts';
import { memberPublicationRuleIds } from './rules/builtin-rules.ts';
import { collectWorkspaceMembers, type WorkspaceMember } from './workspaces/members.ts';
import { type AbsPath, type RelPath, asRelPath } from './contracts/paths.ts';
import type { RepositoryPaths } from './contracts/repository-paths.ts';
import type { FileSystem } from './contracts/file-system.ts';
import { type PM, type Severity, isPM } from './contracts/pms.ts';
import type { Rule } from './contracts/rule.ts';
import type { Reporter } from './contracts/reporter.ts';
import { type ProjectType, isProjectType } from './contracts/project-type.ts';
import type { SiroConfig } from './siro-config.ts';
import type { Finding, LintResult } from './contracts/lint-result.ts';
import { UsageError, ConfigError } from './contracts/errors.ts';
import { applyConfig } from './apply-config.ts';
import { createRepositoryEvaluation, type RepositoryEvaluation } from './parse-config-file.ts';
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

interface LintEvaluation {
  readonly root: RepositoryEvaluation;
  readonly members: readonly WorkspaceMember[];
  readonly pms: readonly PM[];
  readonly pmVersions: Readonly<Partial<Record<PM, string>>>;
  readonly ruleSet: readonly Rule[];
  readonly severityOverrides: ReadonlyMap<string, Severity>;
}

interface PreparedLint {
  readonly evaluation: LintEvaluation;
  readonly reporters: readonly Reporter[];
}

const validateLintOptions = (
  options: LintOptions,
  paths: Pick<RepositoryPaths, 'isAbsolute'>,
): void => {
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
};

/** Prepare repository evaluation without reporting or executing configuration files. */
export const prepareLint = (options: LintOptions, dependencies: LintDependencies): PreparedLint => {
  const { paths, codecFor, createRepoContext } = dependencies;
  validateLintOptions(options, paths);
  const config = options.config === undefined ? undefined : parseConfig(options.config);
  const fs = options.fs === undefined ? dependencies.fileSystem : options.fs;
  const ctx = createRepoContext(options.cwd, fs, options.projectType ?? config?.projectType);
  const root = createRepositoryEvaluation(ctx, codecFor);
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
        { root, fs, pms, projectType: options.projectType ?? config?.projectType },
        dependencies,
      )
    : [];
  return {
    evaluation: {
      root,
      pms,
      pmVersions,
      members,
      ruleSet: configured.rules,
      severityOverrides: configured.severityOverrides,
    },
    reporters: config?.reporters ?? [],
  };
};

const toWorkspaceFinding = (directory: RelPath, finding: Finding): Finding => ({
  ...finding,
  file: `${directory}/${finding.file ?? 'package.json'}`,
  message: `${directory}: ${finding.message}`,
  remediation:
    finding.remediation?.kind === 'manual'
      ? {
          kind: 'manual',
          steps: [`Work in ${directory} for this finding.`, ...finding.remediation.steps],
        }
      : finding.remediation,
});

/** Reuse the existing manifest checks; installation policy remains rooted at cwd. */
export const runPreparedLint = (evaluation: LintEvaluation): LintResult => {
  const { root, pms, pmVersions, ruleSet, severityOverrides, members } = evaluation;
  const result = runLint({ repository: root, pms, pmVersions, ruleSet, severityOverrides });
  const findings = [...result.findings];
  const summary = { ...result.summary };
  const memberRules = ruleSet.filter((rule) => memberPublicationRuleIds.has(rule.id));
  for (const member of members) {
    const child = runLint({
      repository: member.repository,
      pms: [member.pm],
      pmVersions,
      ruleSet: memberRules,
      severityOverrides,
    });
    for (const finding of child.findings) {
      findings.push(toWorkspaceFinding(member.directory, finding));
    }
    for (const level of ['error', 'warn', 'info'] as const) summary[level] += child.summary[level];
  }
  return { findings, summary };
};

export const lint = (options: LintOptions, dependencies: LintDependencies): LintResult =>
  runPreparedLint(prepareLint(options, dependencies).evaluation);
