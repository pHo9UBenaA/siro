import type { AdvisoryRuleBinding, CheckStatus, Rule } from '../entities/rule.ts';
import { type ParsedConfig, getByPath } from '../entities/config-value.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';

const { npmrc, pnpmWorkspace, yarnrc, bunfig, denoJson } = CONFIG_FILES;

const isConfigObject = (value: object): value is ParsedConfig => !Array.isArray(value);

/**
 * Specifiers without any `@version` part fall into "no range" by design: this
 * is a deliberate, best-effort static-check stance. Treating "latest"-style
 * imports as violations would need a different mental model (and ideally
 * resolution against the lockfile), so we leave them alone here.
 */
/** Wildcard segments (`1.x`, `1.*`, `1.2.X`) are ranges too. */
const SPLIT_LIMIT_FIRST = 1;
const FIRST_ELEMENT = 0;

const hasWildcardSegment = (spec: string): boolean => {
  // Only the core version (before the first `-`) is inspected — a prerelease
  // tag may legally contain `x` (`1.0.0-x.1`) without making the specifier a range.
  const core = spec.split('-', SPLIT_LIMIT_FIRST)[FIRST_ELEMENT] ?? spec;
  return core.split('.').some((seg) => seg === 'x' || seg === 'X' || seg === '*');
};

const RANGE_OPERATOR = /[\^~]|>=|<=|<|>|\|\||\s/u;

const isRangeSpec = (spec: string): boolean =>
  spec === '' || spec === '*' || RANGE_OPERATOR.test(spec) || hasWildcardSegment(spec);

const NO_AT_SIGN = 0;
const AFTER_AT_SIGN = 1;

const hasSemverRange = (specifier: string): boolean => {
  if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
    return false;
  }
  const at = specifier.lastIndexOf('@');
  if (at <= NO_AT_SIGN) {
    return false;
  }
  return isRangeSpec(specifier.slice(at + AFTER_AT_SIGN));
};

const collectRangedImports = (imports: Readonly<Record<string, unknown>>): readonly string[] => {
  const offenders: string[] = [];
  for (const [name, value] of Object.entries(imports)) {
    if (typeof value === 'string' && hasSemverRange(value)) {
      offenders.push(`${name}=${value}`);
    }
  }
  return offenders;
};

const MAX_SAMPLE_COUNT = 3;
const EMPTY = 0;

const formatOffenders = (offenders: readonly string[]): CheckStatus => {
  const sample = offenders.slice(FIRST_ELEMENT, MAX_SAMPLE_COUNT).join(', ');
  let more = '';
  if (offenders.length > MAX_SAMPLE_COUNT) {
    more = ` (and ${offenders.length - MAX_SAMPLE_COUNT} more)`;
  }
  return {
    message: `${offenders.length} deno imports use semver ranges: ${sample}${more}. Use \`deno add --save-exact\` or pin manually.`,
    state: 'violation',
  };
};

const OK: CheckStatus = { state: 'ok' };

const extractImportsRecord = (config: ParsedConfig): ParsedConfig | undefined => {
  const imports = getByPath(config, ['imports']);
  if (typeof imports !== 'object' || imports === null || !isConfigObject(imports)) {
    return void 0;
  }
  return imports;
};

const denoBinding: AdvisoryRuleBinding = {
  check(_ctx, config): CheckStatus {
    const imports = extractImportsRecord(config);
    if (!imports) {
      return OK;
    }
    const offenders = collectRangedImports(imports);
    if (offenders.length === EMPTY) {
      return OK;
    }
    return formatOffenders(offenders);
  },
  docs: 'https://docs.deno.com/runtime/reference/cli/add/',
  file: denoJson,
  fix() {
    return [
      {
        file: denoJson,
        message:
          'Run `deno add --save-exact <pkg>` for each ranged import in deno.json, or rewrite the `imports` entries to use exact versions.',
        op: 'note',
      },
    ];
  },
  fixKind: 'advisory',
};

// Coverage notes:
// - aube: no binding — `savePrefix` is not documented in aube's official
//   configuration docs (see docs/version-matrix.md "Known open items",
//   last checked 2026-06-06). Re-add the binding when upstream documents
//   the key; instructing users to set an unverified key is worse than a
//   missing cell in the comparison matrix.
const baseRule = requireConfigKey({
  bindings: {
    bun: {
      docs: 'https://bun.com/docs/runtime/bunfig#install-exact',
      file: bunfig,
      keyPath: ['install', 'exact'],
      message: 'Set `exact = true` under [install] in bunfig.toml to pin exact versions.',
      value: true,
      versionNote: { configAvailableSince: 'bun 0.6.10' },
    },
    npm: {
      docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#save-exact',
      extraFix: [{ keyPath: ['save-prefix'], value: '' }],
      file: npmrc,
      keyPath: ['save-exact'],
      message: 'Set `save-exact=true` (and `save-prefix=`) in .npmrc to pin exact versions.',
      value: true,
    },
    pnpm: {
      docs: 'https://pnpm.io/settings#saveprefix',
      file: pnpmWorkspace,
      keyPath: ['savePrefix'],
      message: "Set `savePrefix: ''` in pnpm-workspace.yaml to pin exact versions.",
      value: '',
    },
    yarn: {
      docs: 'https://yarnpkg.com/configuration/yarnrc#defaultSemverRangePrefix',
      file: yarnrc,
      keyPath: ['defaultSemverRangePrefix'],
      message: "Set `defaultSemverRangePrefix: ''` in .yarnrc.yml to pin exact versions.",
      value: '',
      versionNote: { configAvailableSince: 'yarn 2.0.0' },
    },
  },
  description:
    'Semver ranges (^, ~) auto-adopt new releases, including compromised ones. Save exact versions by default.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#1-pin-dependency-versions',
  id: 'pin-exact-versions',
  severity: 'error',
  title: 'Pin exact dependency versions',
});

// The deno check iterates `imports` values rather than checking one key, which
// doesn't fit `requireConfigKey`'s single-key/single-value model — attach it
// post-hoc via `overrideBindings` instead of polluting the builder with a
// value-iteration mode for one rule. If more rules need this shape (yarn
// `resolutions`, pnpm `overrides`, etc.), extract an `inspectConfigValues`
// builder rather than growing requireConfigKey.
export const pinExactVersions: Rule = overrideBindings(baseRule, { deno: denoBinding });
