import type { LintDependencies } from './contracts/lint-dependencies.ts';
import { scopeOf } from './rules/builtin-rules.ts';
import type { AbsPath } from './contracts/paths.ts';
import type { RepositoryPaths } from './contracts/repository-paths.ts';
import type { FileSystem } from './contracts/file-system.ts';
import { type PM, type Severity, isPM, parsePackageManagerField, PMS } from './contracts/pms.ts';
import type { Rule } from './contracts/rule.ts';
import type { Reporter } from './contracts/reporter.ts';
import { type ProjectType, isProjectType } from './contracts/project-type.ts';
import type { SiroConfig } from './siro-config.ts';
import type { Finding, LintResult, PolicyTarget, Inspection } from './contracts/lint-result.ts';
import { ConfigError, UsageError } from './contracts/errors.ts';
import { applyConfig } from './apply-config.ts';
import { resolvePMs } from './resolve-pms.ts';
import { parseConfig } from './parse-siro-config.ts';
import { runLint } from './run-lint.ts';
import { declaredPMVersion, isStableVersion } from './pm-versions.ts';
import { discover, type DiscoveredDirectory } from './discovery.ts';
import {
  parseExcludes,
  parseInstallationRoots,
  type InstallationRootInput,
} from './inspection-options.ts';
import { createUnsupportedSettings } from './rules/unsupported-settings.ts';
import { checkManifest, manifestProjectType } from './manifest-checks.ts';
import { rebaseFinding } from './rebase-finding.ts';

export interface LintOptions {
  readonly cwd: AbsPath;
  readonly fs?: FileSystem;
  /** Applies only to cwd, never to discovered children or additional installation roots. */
  readonly pm?: PM;
  readonly pmVersion?: string;
  readonly exclude?: readonly string[];
  /** Replaces config/default ['.']; [] disables installation checks. */
  readonly installationRoots?: readonly InstallationRootInput[];
  readonly projectType?: ProjectType;
  /** Explicit configuration; the library never imports files from the target repository. */
  readonly config?: SiroConfig;
}

interface DirectoryEvaluation extends DiscoveredDirectory {
  readonly targets: readonly PolicyTarget[];
  readonly installation: boolean;
}
interface LintEvaluation {
  readonly directories: readonly DirectoryEvaluation[];
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
  if (!options || !paths.isAbsolute(options.cwd))
    throw new UsageError('cwd must be an absolute filesystem path.');
  if ('workspaces' in options)
    throw new UsageError(
      'workspaces was removed in 0.6.0. Package discovery is recursive by default; use exclude and installationRoots to specify scope.',
    );
  if ('customRules' in options || 'reporters' in options)
    throw new UsageError('Pass customRules and reporters inside the config option.');
  if (options.pm !== undefined && !isPM(options.pm))
    throw new UsageError(`Unknown package manager: ${String(options.pm)}`);
  if (options.projectType !== undefined && !isProjectType(options.projectType))
    throw new UsageError(`Unknown project type: ${String(options.projectType)}`);
  if (options.pmVersion !== undefined && (!options.pm || !isStableVersion(options.pmVersion)))
    throw new UsageError(
      'pmVersion / --pm-version requires pm / --pm and an exact stable version such as 10.16.0.',
    );
};

/** Validate inputs and prepare shared contexts, without running rules or child executable configs. */
export const prepareLint = (options: LintOptions, dependencies: LintDependencies): PreparedLint => {
  validateLintOptions(options, dependencies.paths);
  const config = options.config === undefined ? undefined : parseConfig(options.config);
  const fs = options.fs === undefined ? dependencies.fileSystem : options.fs;
  const excluded = dependencies.compileExclusions(
    parseExcludes(options.exclude !== undefined ? options.exclude : (config?.exclude ?? [])),
  );
  const installations = parseInstallationRoots(
    options.installationRoots !== undefined
      ? options.installationRoots
      : (config?.installationRoots ?? ['.']),
  );
  const configured = applyConfig(dependencies.rules, config);
  const needsCustomTarget = configured.rules.some((rule) => scopeOf(rule.id) === 'custom');
  const discovered = discover(
    options.cwd,
    fs,
    excluded,
    options.projectType ?? config?.projectType,
    dependencies,
  );
  for (const entry of installations) {
    if (!discovered.some((item) => item.directory === entry.path))
      throw new UsageError(
        `${entry.path}: installation root must be an existing, selected ordinary directory using its exact enumerated spelling (no symlinks, excluded or hard-skipped paths).`,
      );
  }
  const directories = discovered.map((item): DirectoryEvaluation => {
    const { ctx } = item.repository;
    const entry = installations.find((root) => root.path === item.directory);
    let pms: readonly PM[];
    let versions = declaredPMVersion(ctx.packageJson?.packageManager);
    if (item.directory === '.') {
      pms = resolvePMs(ctx, {
        allowed: config?.pms,
        pmOverride: options.pm,
        optional: !entry && !needsCustomTarget,
      });
      versions = {
        ...versions,
        ...config?.pmVersions,
        ...(options.pm && options.pmVersion ? { [options.pm]: options.pmVersion } : {}),
      };
    } else if (entry) {
      try {
        pms = resolvePMs(ctx, { pmOverride: entry.pm });
      } catch (error) {
        if (error instanceof UsageError)
          throw new UsageError(`${item.directory}: ${error.message}`);
        throw error;
      }
      if (entry.pm && entry.pmVersion) versions = { ...versions, [entry.pm]: entry.pmVersion };
    } else {
      const declared =
        ctx.packageJson?.packageManager === undefined
          ? undefined
          : parsePackageManagerField(ctx.packageJson.packageManager);
      pms = PMS.filter(
        (pm) => pm === declared || (pm === 'deno' && item.manifests.includes('deno.json')),
      );
    }
    return {
      ...item,
      installation: entry !== undefined,
      targets: pms.map((pm) => ({
        pm,
        ...(versions[pm] === undefined ? {} : { version: versions[pm] }),
      })),
    };
  });
  return {
    evaluation: {
      directories,
      ruleSet: configured.rules,
      severityOverrides: configured.severityOverrides,
    },
    reporters: config?.reporters ?? [],
  };
};

export const runPreparedLint = (evaluation: LintEvaluation): LintResult => {
  const { directories, ruleSet, severityOverrides } = evaluation;
  const findings: Finding[] = [];
  const manifests: Inspection['manifests'][number][] = [];
  const installationRoots: Inspection['installationRoots'][number][] = [];
  const ruleOrder = new Map(ruleSet.map((rule, index) => [rule.id, index]));
  for (const item of directories) {
    const { directory, repository, targets, installation } = item;
    const local: Finding[] = [];
    for (const file of item.manifests) {
      const manifestTargets = targets.filter(({ pm }) =>
        file === 'deno.json' ? pm === 'deno' : pm !== 'deno',
      );
      manifests.push({
        path: directory === '.' ? file : `${directory}/${file}`,
        projectType: manifestProjectType(repository, file),
        targets: manifestTargets,
      });
      local.push(...checkManifest(repository, file, manifestTargets, ruleSet, severityOverrides));
    }
    if (installation) installationRoots.push({ directory, targets });
    const scopedRules = ruleSet.flatMap((rule): Rule[] => {
      const scope = scopeOf(rule.id);
      if ((scope === 'installation' && installation) || (scope === 'custom' && directory === '.'))
        return [rule];
      if (scope === 'split' && installation)
        return [
          {
            ...rule,
            bindings: createUnsupportedSettings(
              (file) => file !== 'package.json' && file !== 'deno.json',
            ).bindings,
          },
        ];
      return [];
    });
    try {
      local.push(
        ...runLint({
          repository,
          pms: targets.map(({ pm }) => pm),
          pmVersions: Object.fromEntries(targets.map(({ pm, version }) => [pm, version])),
          ruleSet: scopedRules,
          severityOverrides,
        }).findings,
      );
    } catch (error) {
      if (error instanceof ConfigError && directory !== '.')
        throw new ConfigError(`${directory}/${error.message}`);
      throw error;
    }
    // Stable user-facing rule order is independent of traversal/read order.
    local.sort((a, b) => (ruleOrder.get(a.ruleId) ?? 0) - (ruleOrder.get(b.ruleId) ?? 0));
    findings.push(...local.map((finding) => rebaseFinding(directory, finding)));
  }
  const summary = { error: 0, warn: 0, info: 0 };
  for (const finding of findings) summary[finding.severity] += 1;
  return { findings, summary, inspection: { manifests, installationRoots } };
};

export const lint = (options: LintOptions, dependencies: LintDependencies): LintResult =>
  runPreparedLint(prepareLint(options, dependencies).evaluation);
