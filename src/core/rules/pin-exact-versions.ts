import { proposeChanges } from './remediation.ts';
import { ConfigError } from '../contracts/errors.ts';
import valid from 'semver/functions/valid.js';
import { isPlainRecord } from '../contracts/records.ts';
import type { RuleBinding, CheckStatus } from '../contracts/rule.ts';
import { type ParsedConfig, getByPath } from '../contracts/config-value.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../config-files.ts';

const { npmrc, pnpmWorkspace, yarnrc, bunfig, denoJson } = CONFIG_FILES;

const REGISTRY_VERSION = /^(?:npm|jsr):(?:@[^/@]+\/)?[^/@]+@(?<version>[^/]*)/u;

const isUnpinnedRegistryImport = (specifier: string): boolean => {
  if (!specifier.startsWith('npm:') && !specifier.startsWith('jsr:')) return false;
  const version = REGISTRY_VERSION.exec(specifier)?.groups?.version;
  const normalized = version?.startsWith('=') ? version.slice(1) : version;
  return normalized === undefined || valid(normalized) === null;
};

const collectUnpinnedImports = (imports: unknown, location: string): string[] => {
  if (!isPlainRecord(imports))
    throw new ConfigError(`deno.json: ${location} must be an import mapping object.`);
  const offenders: string[] = [];
  for (const [name, value] of Object.entries(imports)) {
    if (value === null) continue; // Import-map blocking entries are not dependency ranges.
    if (typeof value !== 'string')
      throw new ConfigError(`deno.json: ${location}.${name} must be a string or null.`);
    if (isUnpinnedRegistryImport(value)) offenders.push(`${location}.${name}=${value}`);
  }
  return offenders;
};

const MAX_SAMPLE_COUNT = 3;

const createUnpinnedImportsViolation = (offenders: readonly string[]): CheckStatus => {
  const sample = offenders.slice(0, MAX_SAMPLE_COUNT).join(', ');
  const more =
    offenders.length > MAX_SAMPLE_COUNT ? ` (and ${offenders.length - MAX_SAMPLE_COUNT} more)` : '';
  return {
    remediation: {
      kind: 'manual',
      steps: [
        'Pin each reported imports/scopes entry in deno.json to an exact version. For top-level imports, `deno add --save-exact <pkg>` can help; edit scoped mappings at their reported locations.',
      ],
    },
    message: `${offenders.length} deno imports are not pinned: ${sample}${more}. Use \`deno add --save-exact\` or pin manually.`,
    state: 'violation',
  };
};

const collectUnpinnedInlineImports = (config: ParsedConfig): string[] => {
  const imports = getByPath(config, ['imports']);
  const offenders = imports == null ? [] : collectUnpinnedImports(imports, 'imports');
  const scopes = getByPath(config, ['scopes']);
  if (scopes == null) return offenders;
  if (!isPlainRecord(scopes)) throw new ConfigError('deno.json: scopes must be an object.');
  for (const [scope, mapping] of Object.entries(scopes)) {
    for (const offender of collectUnpinnedImports(mapping, `scopes[${JSON.stringify(scope)}]`))
      offenders.push(offender);
  }
  return offenders;
};

const denoBinding: RuleBinding = {
  check(_ctx, config): CheckStatus {
    const offenders = collectUnpinnedInlineImports(config);
    if (offenders.length === 0) {
      return { state: 'ok' };
    }
    return createUnpinnedImportsViolation(offenders);
  },
  docs: 'https://docs.deno.com/runtime/reference/cli/add/',
  file: denoJson,
  versionNote: { configAvailableSince: 'deno 1.30.0' },
};

const npmBinding: RuleBinding = {
  file: npmrc,
  docs: 'https://docs.npmjs.com/cli/v12/using-npm/config#save-exact',
  check(_ctx, config) {
    const exact = getByPath(config, ['save-exact']);
    const prefix = getByPath(config, ['save-prefix']);
    if (exact === true || prefix === '' || prefix === '=') return { state: 'ok' };
    return {
      remediation: proposeChanges(config, [
        { op: 'setKey', file: npmrc, keyPath: ['save-exact'], value: true },
      ]),
      state: 'violation',
      actual: exact,
      expected: true,
      message: 'Set `save-exact=true` in .npmrc to save exact versions by default.',
    };
  },
};

const aubeBinding: RuleBinding = {
  file: npmrc,
  docs: 'https://aube.sh/settings/#setting-saveprefix',
  check(_ctx, config) {
    const prefixes = ['save-prefix', 'savePrefix']
      .filter((key) => Object.hasOwn(config, key))
      .map((key) => config[key]);
    if (prefixes.length > 0 && prefixes.every((value) => value === '')) return { state: 'ok' };
    return {
      remediation: {
        kind: 'manual',
        steps: [
          'Use one `save-prefix=` entry in .npmrc. Aube resolves aliases by line order; reconcile conflicting entries before changing them.',
        ],
      },
      state: 'violation',
      message: 'Set `save-prefix=` in .npmrc; remove any conflicting `savePrefix` alias.',
    };
  },
};

const baseRule = requireConfigKey({
  bindings: {
    bun: {
      docs: 'https://bun.com/docs/runtime/bunfig#install-exact',
      file: bunfig,
      keyPath: ['install', 'exact'],
      message: 'Set `exact = true` under [install] in bunfig.toml to pin exact versions.',
      value: true,
      versionNote: { note: 'install.exact verified in bun 1.2.0' },
    },
    pnpm: {
      accept: (value) => value === '' || value === '=',
      docs: 'https://pnpm.io/settings/other#saveprefix',
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
    'Semver ranges (^, ~) auto-adopt new releases, including compromised ones. Save exact versions by default; for Deno, inspect registry mappings in both inline imports and scopes (not external import maps).',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#4-pin-dependency-versions',
  id: 'pin-exact-versions',
  severity: 'error',
  title: 'Pin exact dependency versions',
});

export const pinExactVersions = overrideBindings(baseRule, {
  aube: aubeBinding,
  deno: denoBinding,
  npm: npmBinding,
});
