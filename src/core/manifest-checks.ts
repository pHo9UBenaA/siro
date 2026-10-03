import type { Finding, PolicyTarget } from './contracts/lint-result.ts';
import type { Severity } from './contracts/pms.ts';
import type { Rule, RuleBinding } from './contracts/rule.ts';
import type { RepositoryEvaluation } from './parse-config-file.ts';
import { resolveDenoProjectType, resolvePackageJsonProjectType } from './resolve-project-type.ts';
import { CONFIG_FILES } from './config-files.ts';
import { packageJsonFilesBinding, denoPublishBinding } from './rules/files-field.ts';
import { publishAccessBinding } from './rules/publish-access.ts';
import { createUnsupportedSettings } from './rules/unsupported-settings.ts';
import type { ManifestRuleId } from './rules/builtin-rules.ts';
import { evaluateBinding } from './evaluate-binding.ts';
import { runLint } from './run-lint.ts';

type ManifestFile = 'package.json' | 'deno.json';
// Coverage is static; each binding still reads the current repository and PM version.
const unsupportedManifestBindings: Record<ManifestFile, Rule['bindings']> = {
  'package.json': createUnsupportedSettings((file) => file === 'package.json').bindings,
  'deno.json': createUnsupportedSettings((file) => file === 'deno.json').bindings,
};

export const manifestProjectType = (repository: RepositoryEvaluation, file: ManifestFile) =>
  file === 'deno.json'
    ? resolveDenoProjectType(repository.ctx, repository.parseConfig(CONFIG_FILES.denoJson))
    : resolvePackageJsonProjectType(repository.ctx);

// The scope registry cannot add a manifest rule without supplying its dispatch here.
const selectManifestBinding: Record<
  ManifestRuleId,
  (
    file: ManifestFile,
    repository: RepositoryEvaluation,
    targets: readonly PolicyTarget[],
  ) => RuleBinding | 'use-pm-bindings' | undefined
> = {
  'files-field': (file) => (file === 'deno.json' ? denoPublishBinding : packageJsonFilesBinding),
  'publish-access': (file, repository, targets) => {
    if (file !== 'package.json') return undefined;
    // Only npm accepts the nonportable private alias. Unknown targets use the
    // generic portable-value check, never an invented npm target.
    return repository.ctx.packageJson?.publishConfig?.access === 'private' && targets.length > 0
      ? 'use-pm-bindings'
      : publishAccessBinding;
  },
};

export const checkManifest = (
  repository: RepositoryEvaluation,
  file: ManifestFile,
  targets: readonly PolicyTarget[],
  rules: readonly Rule[],
  overrides: ReadonlyMap<string, Severity>,
): Finding[] => {
  const findings: Finding[] = [];
  const projectType = manifestProjectType(repository, file);
  for (const rule of rules) {
    if (rule.projectTypes && !rule.projectTypes.includes(projectType)) continue;
    if (rule.id === 'unsupported-settings') {
      const unsupported = runLint({
        repository,
        targets,
        ruleSet: [{ ...rule, bindings: unsupportedManifestBindings[file] }],
        severityOverrides: overrides,
      }).findings;
      for (const finding of unsupported) findings.push(finding);
      continue;
    }
    if (!Object.hasOwn(selectManifestBinding, rule.id)) continue;
    const binding = selectManifestBinding[rule.id as ManifestRuleId](file, repository, targets);
    if (binding === undefined) continue;
    if (binding === 'use-pm-bindings') {
      const evaluated = runLint({
        repository,
        targets,
        ruleSet: [rule],
        severityOverrides: overrides,
      }).findings;
      for (const finding of evaluated) findings.push(finding);
      continue;
    }
    for (const finding of evaluateBinding(repository, rule, binding, overrides))
      findings.push(finding);
  }
  return findings;
};
