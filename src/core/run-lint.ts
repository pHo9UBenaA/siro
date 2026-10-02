import { CONFIG_FILES } from './config-files.ts';
import type { Finding, LintResult, PolicyTarget } from './contracts/lint-result.ts';
import type { PM, Severity } from './contracts/pms.ts';
import type { ProjectType } from './contracts/project-type.ts';
import type { Rule } from './contracts/rule.ts';
import type { RepoContext } from './contracts/repo-context.ts';
import type { ConfigParser, RepositoryEvaluation } from './parse-config-file.ts';
import { resolveDenoProjectType, resolvePackageJsonProjectType } from './resolve-project-type.ts';
import { evaluateBinding } from './evaluate-binding.ts';

export interface RunLintOptions {
  readonly repository: RepositoryEvaluation;
  readonly targets: readonly PolicyTarget[];
  readonly ruleSet: readonly Rule[];
  readonly severityOverrides?: ReadonlyMap<string, Severity>;
}

const resolveBindingProjectType = (
  ctx: RepoContext,
  pm: PM,
  parseConfig: ConfigParser,
): ProjectType => {
  if (ctx.projectType !== undefined) return ctx.projectType;
  return pm === 'deno'
    ? resolveDenoProjectType(ctx, parseConfig(CONFIG_FILES.denoJson))
    : resolvePackageJsonProjectType(ctx);
};

/** Select applicable PM bindings; response handling is shared with manifest checks. */
export const runLint = (opts: RunLintOptions): Pick<LintResult, 'findings'> => {
  const { repository, targets, ruleSet, severityOverrides } = opts;
  const findings: Finding[] = [];
  for (const rule of ruleSet) {
    for (const target of targets) {
      const { pm } = target;
      const binding = rule.bindings[pm];
      if (
        !binding ||
        (rule.projectTypes &&
          !rule.projectTypes.includes(
            resolveBindingProjectType(repository.ctx, pm, repository.parseConfig),
          ))
      )
        continue;
      const evaluated = evaluateBinding(repository, rule, binding, severityOverrides, target);
      for (const finding of evaluated) findings.push(finding);
    }
  }
  return { findings };
};
