import type { Finding, PolicyTarget } from './contracts/lint-result.ts';
import { ConfigError } from './contracts/errors.ts';
import type { Severity } from './contracts/pms.ts';
import { isCheckStatusShape, type Rule, type RuleBinding } from './contracts/rule.ts';
import type { RepositoryEvaluation } from './parse-config-file.ts';
import { resolveDenoProjectType, resolvePackageJsonProjectType } from './resolve-project-type.ts';
import { CONFIG_FILES } from './config-files.ts';
import { packageJsonFilesBinding, denoPublishBinding } from './rules/files-field.ts';
import { publishAccessBinding } from './rules/publish-access.ts';
import { createUnsupportedSettings } from './rules/unsupported-settings.ts';
import { decideSeverity } from './decide-severity.ts';
import { runLint } from './run-lint.ts';

export const manifestProjectType = (repository: RepositoryEvaluation, file: string) =>
  file === 'deno.json'
    ? resolveDenoProjectType(repository.ctx, repository.parseConfig(CONFIG_FILES.denoJson))
    : resolvePackageJsonProjectType(repository.ctx);

const genericCheck = (
  repository: RepositoryEvaluation,
  rule: Rule,
  binding: RuleBinding,
  overrides: ReadonlyMap<string, Severity>,
): Finding[] => {
  const response: unknown = binding.check(
    { ...repository.ctx, readConfig: repository.parseConfig },
    repository.parseConfig(binding.file),
  );
  if (!isCheckStatusShape(response))
    throw new ConfigError(`Rule '${rule.id}' returned an invalid check result.`);
  const statuses = response.state === 'violations' ? response.violations : [response];
  return statuses.flatMap((status): Finding[] =>
    status.state !== 'violation'
      ? []
      : [
          {
            ruleId: rule.id,
            directory: '.',
            severity: decideSeverity(status, binding, rule, overrides.get(rule.id)),
            message: status.message,
            file: status.file ?? binding.file?.path,
            docs: binding.docs ?? rule.docs,
            actual: status.actual,
            expected: status.expected,
            remediation: status.remediation,
          },
        ],
  );
};

export const checkManifest = (
  repository: RepositoryEvaluation,
  file: 'package.json' | 'deno.json',
  targets: readonly PolicyTarget[],
  rules: readonly Rule[],
  overrides: ReadonlyMap<string, Severity>,
): Finding[] => {
  const findings: Finding[] = [];
  const projectType = manifestProjectType(repository, file);
  const pms = targets.map((target) => target.pm);
  const pmVersions = Object.fromEntries(targets.map((target) => [target.pm, target.version]));
  for (const rule of rules) {
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
    } else if (projectType === 'package' && rule.id === 'files-field') {
      findings.push(
        ...genericCheck(
          repository,
          rule,
          file === 'deno.json' ? denoPublishBinding : packageJsonFilesBinding,
          overrides,
        ),
      );
    } else if (
      projectType === 'package' &&
      file === 'package.json' &&
      rule.id === 'publish-access'
    ) {
      // Only npm accepts the nonportable 'private' alias. Unknown targets get a
      // portable-value advisory, not an invented npm binding.
      if (repository.ctx.packageJson?.publishConfig?.access === 'private' && targets.length > 0) {
        findings.push(
          ...runLint({ repository, pms, pmVersions, ruleSet: [rule], severityOverrides: overrides })
            .findings,
        );
      } else {
        findings.push(...genericCheck(repository, rule, publishAccessBinding, overrides));
      }
    }
  }
  return findings;
};
