import type { AbsPath } from '../shared/paths.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import type { PM, Severity } from '../domain/entities/pms.ts';
import type { RepoContext } from '../domain/ports/repo-context.ts';
import type { Rule } from '../domain/entities/rule.ts';
import type { SiroConfig } from '../domain/entities/siro-config.ts';
import { applyConfig } from '../domain/services/apply-config.ts';
import { assertConfigRuleIdsKnown } from './validate-config-rules.ts';
import { createRepoContext } from '../adapters/repo-context.ts';
import { loadConfig } from '../adapters/config-loader.ts';
import { mergeProgrammaticRules } from '../domain/services/merge-programmatic-rules.ts';
import { resolvePMs } from '../domain/services/resolve-pms.ts';
import { rules } from '../domain/builtin-rules.ts';
import type { ProjectType } from '../domain/entities/project-type.ts';

export interface PrepareOptions {
  readonly cwd: AbsPath;
  readonly fs?: FileSystem;
  readonly pm?: PM;
  readonly projectType?: ProjectType;
  readonly customRules?: readonly Rule[];
}

export interface PreparedRun {
  readonly userConfig: SiroConfig | undefined;
  readonly ctx: RepoContext;
  readonly pms: readonly PM[];
  readonly ruleSet: readonly Rule[];
  readonly severityOverrides: ReadonlyMap<string, Severity>;
}

const configureRuleSet = (
  userConfig: SiroConfig | undefined,
  customRules: readonly Rule[] | undefined,
): ReturnType<typeof applyConfig> => {
  const base = mergeProgrammaticRules(rules, customRules, userConfig?.customRules);
  assertConfigRuleIdsKnown(userConfig, customRules);
  return applyConfig(base, userConfig);
};

export const prepareRun = async (options: PrepareOptions): Promise<PreparedRun> => {
  const userConfig = await loadConfig(options.cwd, options.fs);
  const { cwd, fs, pm, customRules } = options;
  const projectType = options.projectType ?? userConfig?.projectType;
  const ctx = createRepoContext(cwd, fs, projectType);
  const pms = resolvePMs(ctx, { allowed: userConfig?.pms, pmOverride: pm });
  const { rules: ruleSet, severityOverrides } = configureRuleSet(userConfig, customRules);
  return { ctx, pms, ruleSet, severityOverrides, userConfig };
};
