import type { PM } from './entities/pms.ts';
import type { ConfigFileRef } from './entities/rule.ts';
import type { KeyPath } from './entities/config-value.ts';
import { CONFIG_FILES } from './entities/config-files.ts';

interface SettingAvailability {
  readonly pm: PM;
  readonly file: ConfigFileRef;
  readonly keyPath: KeyPath;
  /** First stable version supporting this setting in this file. */
  readonly since: string;
  readonly source: string;
}

const { npmrc, packageJson, pnpmWorkspace, yarnrc, bunfig } = CONFIG_FILES;

// Verified release history only. Display-only VersionNote prose is not executable policy.
// This list also generates the public coverage table in docs/rules.md.
export const settingAvailability = [
  {
    pm: 'npm',
    file: npmrc,
    keyPath: ['provenance'],
    since: '9.5.0',
    source: 'https://github.com/npm/cli/releases/tag/v9.5.0',
  },
  {
    pm: 'npm',
    file: packageJson,
    keyPath: ['publishConfig', 'provenance'],
    since: '9.5.0',
    source: 'https://github.com/npm/cli/releases/tag/v9.5.0',
  },
  {
    pm: 'npm',
    file: npmrc,
    keyPath: ['min-release-age'],
    since: '11.10.0',
    source: 'https://github.com/npm/cli/releases/tag/v11.10.0',
  },
  // strictDepBuilds itself arrived in 10.3; this YAML location needs 10.6.
  {
    pm: 'pnpm',
    file: pnpmWorkspace,
    keyPath: ['strictDepBuilds'],
    since: '10.6.0',
    source: 'https://github.com/pnpm/pnpm/releases/tag/v10.6.0',
  },
  {
    pm: 'pnpm',
    file: pnpmWorkspace,
    keyPath: ['dangerouslyAllowAllBuilds'],
    since: '10.9.0',
    source: 'https://github.com/pnpm/pnpm/releases/tag/v10.9.0',
  },
  {
    pm: 'pnpm',
    file: pnpmWorkspace,
    keyPath: ['minimumReleaseAge'],
    since: '10.16.0',
    source: 'https://github.com/pnpm/pnpm/releases/tag/v10.16.0',
  },
  {
    pm: 'pnpm',
    file: pnpmWorkspace,
    keyPath: ['minimumReleaseAgeExclude'],
    since: '10.16.0',
    source: 'https://github.com/pnpm/pnpm/releases/tag/v10.16.0',
  },
  {
    pm: 'pnpm',
    file: pnpmWorkspace,
    keyPath: ['trustPolicy'],
    since: '10.21.0',
    source: 'https://github.com/pnpm/pnpm/releases/tag/v10.21.0',
  },
  {
    pm: 'pnpm',
    file: pnpmWorkspace,
    keyPath: ['blockExoticSubdeps'],
    since: '10.26.0',
    source: 'https://github.com/pnpm/pnpm/releases/tag/v10.26.0',
  },
  {
    pm: 'pnpm',
    file: pnpmWorkspace,
    keyPath: ['frozenStore'],
    since: '11.7.0',
    source: 'https://github.com/pnpm/pnpm/releases/tag/v11.7.0',
  },
  {
    pm: 'yarn',
    file: yarnrc,
    keyPath: ['enableHardenedMode'],
    since: '4.0.0',
    source: 'https://yarnpkg.com/blog/release/4.0',
  },
  {
    pm: 'yarn',
    file: yarnrc,
    keyPath: ['npmMinimalAgeGate'],
    since: '4.10.0',
    source: 'https://github.com/yarnpkg/berry/releases/tag/@yarnpkg/cli/4.10.0',
  },
  {
    pm: 'yarn',
    file: yarnrc,
    keyPath: ['npmPreapprovedPackages'],
    since: '4.10.0',
    source: 'https://github.com/yarnpkg/berry/releases/tag/@yarnpkg/cli/4.10.0',
  },
  {
    pm: 'bun',
    file: bunfig,
    keyPath: ['install', 'minimumReleaseAge'],
    since: '1.3.0',
    source: 'https://bun.com/blog/bun-v1.3#minimum-release-age',
  },
  {
    pm: 'bun',
    file: bunfig,
    keyPath: ['install', 'security', 'scanner'],
    since: '1.2.21',
    source: 'https://bun.com/blog/bun-v1.2.21#security-scanner-api-for-bun-install',
  },
] as const satisfies readonly SettingAvailability[];
