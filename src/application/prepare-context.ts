import type { AbsPath } from '../shared/paths.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import type { PM } from '../domain/entities/pms.ts';
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

export interface PrepareOptions {
  readonly cwd: AbsPath;
  readonly fs?: FileSystem;
  readonly pm?: PM;
  readonly customRules?: readonly Rule[];
}

export interface PreparedRun {
  readonly userConfig: SiroConfig | undefined;
  readonly ctx: RepoContext;
  readonly pms: readonly PM[];
  readonly ruleSet: readonly Rule[];
}

/**
 * Shared composition-root preamble for `lint` (kept separate so a future
 * command cannot drift from the load → context → resolve → merge → validate →
 * applyConfig protocol).
 */
const resolveRuleSet = (
  userConfig: SiroConfig | undefined,
  customRules: readonly Rule[] | undefined,
): readonly Rule[] => {
  let configCustomRules: SiroConfig['customRules'] | undefined = void 0;
  if (userConfig) {
    configCustomRules = userConfig.customRules;
  }
  const base = mergeProgrammaticRules(rules, customRules, configCustomRules);
  assertConfigRuleIdsKnown(userConfig, customRules);
  return applyConfig(base, userConfig);
};

const buildRunResult = (
  options: PrepareOptions,
  userConfig: SiroConfig | undefined,
): PreparedRun => {
  const { cwd, fs, pm, customRules } = options;
  const ctx = createRepoContext(cwd, fs);
  let allowedPms: SiroConfig['pms'] | undefined = void 0;
  if (userConfig) {
    allowedPms = userConfig.pms;
  }
  const pms = resolvePMs(ctx, { allowed: allowedPms, pmOverride: pm });
  const ruleSet = resolveRuleSet(userConfig, customRules);
  return { ctx, pms, ruleSet, userConfig };
};

export const prepareRun = (options: PrepareOptions): Promise<PreparedRun> =>
  loadConfig(options.cwd, options.fs).then((userConfig) => buildRunResult(options, userConfig));
