import type { PM, Severity } from './pms.ts';
import type { BuiltinRuleId } from './rule-id.ts';
import type { Reporter } from '../ports/reporter.ts';
import type { Rule } from './rule.ts';

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
