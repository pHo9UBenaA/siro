import { CONFIG_FILES } from './config-files.ts';
import type { Finding, LintResult } from './contracts/lint-result.ts';
import type { PM, Severity } from './contracts/pms.ts';
import type { ProjectType } from './contracts/project-type.ts';
import type { Rule } from './contracts/rule.ts';
import type { RepoContext } from './contracts/repo-context.ts';
import type { ConfigParser, RepositoryEvaluation } from './parse-config-file.ts';
import { resolveDenoProjectType, resolvePackageJsonProjectType } from './resolve-project-type.ts';
import { evaluateBinding } from './evaluate-binding.ts';

export interface RunLintOptions {
  readonly repository: RepositoryEvaluation;
  readonly pms: readonly PM[];
  readonly pmVersions?: Readonly<Partial<Record<PM, string>>>;
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
  const { repository, pms, ruleSet, severityOverrides } = opts;
  const findings: Finding[] = [];
  for (const rule of ruleSet) {
    for (const pm of pms) {
      const binding = rule.bindings[pm];
      if (
        !binding ||
        (rule.projectTypes &&
          !rule.projectTypes.includes(
            resolveBindingProjectType(repository.ctx, pm, repository.parseConfig),
          ))
      )
        continue;
      findings.push(
        ...evaluateBinding(repository, rule, binding, severityOverrides, {
          pm,
          version: opts.pmVersions?.[pm],
        }),
      );
    }
  }
  return { findings };
};
