import type { PM, Severity } from './contracts/pms.ts';
import type { BuiltinRuleId } from './rules/builtin-rules.ts';
import type { Reporter } from './contracts/reporter.ts';
import type { Rule } from './contracts/rule.ts';
import type { ProjectType } from './contracts/project-type.ts';

/** Per-rule setting. `'off'` disables; a Severity overrides the default level. */
export type RuleSetting = Severity | 'off';

/**
 * User-facing config returned by `defineConfig` in `siro.config.{ts,mjs,js}`.
 *
 *   defineConfig({
 *     pms: ['npm', 'pnpm'],            // restrict detection
 *     rules: { provenance: 'off' },    // disable / override severity
 *     customRules: [myRule],           // extend
 *     reporters: [mySarifReporter],    // extend
 *   })
 */
export interface SiroConfig {
  readonly pms?: readonly PM[];
  /** Exact stable target versions; does not select managers or inspect installed binaries. */
  readonly pmVersions?: Readonly<Partial<Record<PM, string>>>;
  readonly projectType?: ProjectType;
  // `string & {}` keeps autocompletion for BuiltinRuleId while still
  // permitting arbitrary keys from customRules.
  readonly rules?: Readonly<
    Partial<Record<BuiltinRuleId | (string & Record<never, never>), RuleSetting>>
  >;
  readonly customRules?: readonly Rule[];
  readonly reporters?: readonly Reporter[];
}

/** Identity helper for type-checked config files. */
export const defineConfig = (config: SiroConfig): SiroConfig => config;
