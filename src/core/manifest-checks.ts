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
export const manifestProjectType = (repository: RepositoryEvaluation, file: ManifestFile) =>
  file === 'deno.json'
    ? resolveDenoProjectType(repository.ctx, repository.parseConfig(CONFIG_FILES.denoJson))
    : resolvePackageJsonProjectType(repository.ctx);

// The scope registry cannot add a manifest rule without supplying its dispatch here.
const selectBinding: Record<
  ManifestRuleId,
  (
    file: ManifestFile,
    repository: RepositoryEvaluation,
    targets: readonly PolicyTarget[],
  ) => RuleBinding | 'pm' | undefined
> = {
  'files-field': (file) => (file === 'deno.json' ? denoPublishBinding : packageJsonFilesBinding),
  'publish-access': (file, repository, targets) => {
    if (file !== 'package.json') return undefined;
    // Only npm accepts the nonportable private alias. Unknown targets use the
    // generic portable-value check, never an invented npm target.
    return repository.ctx.packageJson?.publishConfig?.access === 'private' && targets.length > 0
      ? 'pm'
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
  const pms = targets.map((target) => target.pm);
  const pmVersions = Object.fromEntries(targets.map((target) => [target.pm, target.version]));
  for (const rule of rules) {
    if (rule.projectTypes && !rule.projectTypes.includes(projectType)) continue;
    if (rule.id === 'unsupported-settings') {
      findings.push(
        ...runLint({
          repository,
          pms,
          pmVersions,
          ruleSet: [
            { ...rule, bindings: createUnsupportedSettings((path) => path === file).bindings },
          ],
          severityOverrides: overrides,
        }).findings,
      );
    } else if (Object.hasOwn(selectBinding, rule.id)) {
      const binding = selectBinding[rule.id as ManifestRuleId](file, repository, targets);
      if (binding === 'pm') {
        findings.push(
          ...runLint({ repository, pms, pmVersions, ruleSet: [rule], severityOverrides: overrides })
            .findings,
        );
      } else if (binding) {
        findings.push(...evaluateBinding(repository, rule, binding, overrides));
      }
    }
  }
  return findings;
};
