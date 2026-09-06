import { proposeChanges } from './remediation.ts';
import valid from 'semver/functions/valid.js';
import { isPlainRecord } from '../../shared/records.ts';
import type { RuleBinding, CheckStatus } from '../entities/rule.ts';
import { type ParsedConfig, getByPath } from '../entities/config-value.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';

const { npmrc, pnpmWorkspace, yarnrc, bunfig, denoJson } = CONFIG_FILES;

const REGISTRY_VERSION = /^(?:npm|jsr):(?:@[^/@]+\/)?[^/@]+@(?<version>[^/]*)/u;

const isUnpinnedRegistryImport = (specifier: string): boolean => {
  if (!specifier.startsWith('npm:') && !specifier.startsWith('jsr:')) return false;
  const version = REGISTRY_VERSION.exec(specifier)?.groups?.version;
  return version === undefined || valid(version.replace(/^=/u, '')) === null;
};

const collectUnpinnedImports = (imports: Readonly<Record<string, unknown>>): readonly string[] => {
  const offenders: string[] = [];
  for (const [name, value] of Object.entries(imports)) {
    if (typeof value === 'string' && isUnpinnedRegistryImport(value)) {
      offenders.push(`${name}=${value}`);
    }
  }
  return offenders;
};

const MAX_SAMPLE_COUNT = 3;

const formatOffenders = (offenders: readonly string[]): CheckStatus => {
  const sample = offenders.slice(0, MAX_SAMPLE_COUNT).join(', ');
  let more = '';
  if (offenders.length > MAX_SAMPLE_COUNT) {
    more = ` (and ${offenders.length - MAX_SAMPLE_COUNT} more)`;
  }
  return {
    remediation: {
      kind: 'manual',
      steps: [
        'Run `deno add --save-exact <pkg>` for each unpinned registry import in deno.json, or rewrite the `imports` entries to use exact versions.',
      ],
    },
    message: `${offenders.length} deno imports are not pinned: ${sample}${more}. Use \`deno add --save-exact\` or pin manually.`,
    state: 'violation',
  };
};

const OK: CheckStatus = { state: 'ok' };

const extractImportsRecord = (config: ParsedConfig): ParsedConfig | undefined => {
  const imports = getByPath(config, ['imports']);
  if (!isPlainRecord(imports)) {
    return void 0;
  }
  return imports;
};

const denoBinding: RuleBinding = {
  check(_ctx, config): CheckStatus {
    const imports = extractImportsRecord(config);
    if (!imports) {
      return OK;
    }
    const offenders = collectUnpinnedImports(imports);
    if (offenders.length === 0) {
      return OK;
    }
    return formatOffenders(offenders);
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
    if (exact === true || prefix === '' || prefix === '=') return OK;
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
  docs: 'https://aube.jdx.dev/settings/#saveprefix',
  check(_ctx, config) {
    const prefixes = ['save-prefix', 'savePrefix']
      .filter((key) => Object.hasOwn(config, key))
      .map((key) => config[key]);
    if (prefixes.length > 0 && prefixes.every((value) => value === '')) return OK;
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
    'Semver ranges (^, ~) auto-adopt new releases, including compromised ones. Save exact versions by default.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#1-pin-dependency-versions',
  id: 'pin-exact-versions',
  severity: 'error',
  title: 'Pin exact dependency versions',
});

export const pinExactVersions = overrideBindings(baseRule, {
  aube: aubeBinding,
  deno: denoBinding,
  npm: npmBinding,
});
