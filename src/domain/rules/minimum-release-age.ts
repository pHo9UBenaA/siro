import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const SECONDS_PER_DAY = MINUTES_PER_DAY * SECONDS_PER_MINUTE;
const RECOMMENDED_RELEASE_AGE_DAYS = 3;
export const RECOMMENDED_RELEASE_AGE_MINUTES = RECOMMENDED_RELEASE_AGE_DAYS * MINUTES_PER_DAY;
export const RECOMMENDED_RELEASE_AGE_SECONDS = RECOMMENDED_RELEASE_AGE_DAYS * SECONDS_PER_DAY;
export const DOCUMENTED_DEFAULT_MINUTES = MINUTES_PER_DAY;

const { npmrc, pnpmWorkspace, yarnrc, bunfig, denoJson, aubeWorkspace } = CONFIG_FILES;

// Any positive value passes on purpose: the rule's intent is "a cooldown
// exists", and a user who set a shorter window than the recommended 3 days
// made an explicit trade-off siro should not relitigate. Do not tighten
// this to `>= RECOMMENDED_*` — that breaks deliberate short windows.
const ZERO = 0;

const isPositiveNumber = (value: unknown): boolean => typeof value === 'number' && value > ZERO;

const isNonDisabledDenoDuration = (value: unknown): boolean => {
  if (typeof value === 'number') {
    return value > ZERO;
  }
  if (typeof value === 'string') {
    return value !== '' && value !== '0';
  }
  return typeof value === 'object' && value !== null;
};

export const minimumReleaseAge = requireConfigKey({
  bindings: {
    aube: {
      accept: isPositiveNumber,
      docs: 'https://aube.en.dev/settings/',
      documentedDefault: DOCUMENTED_DEFAULT_MINUTES,
      file: aubeWorkspace,
      keyPath: ['minimumReleaseAge'],
      message: `Set minimumReleaseAge (~${RECOMMENDED_RELEASE_AGE_MINUTES} minutes for a 3-day cooldown) in aube-workspace.yaml.`,
      value: RECOMMENDED_RELEASE_AGE_MINUTES,
    },
    bun: {
      accept: isPositiveNumber,
      docs: 'https://bun.com/docs/runtime/bunfig#install-minimumreleaseage',
      file: bunfig,
      keyPath: ['install', 'minimumReleaseAge'],
      message: `Set install.minimumReleaseAge (bun) to ~${RECOMMENDED_RELEASE_AGE_SECONDS} seconds to quarantine brand-new releases.`,
      value: RECOMMENDED_RELEASE_AGE_SECONDS,
      versionNote: { configAvailableSince: 'bun 1.3.0' },
    },
    deno: {
      accept: isNonDisabledDenoDuration,
      docs: 'https://docs.deno.com/runtime/reference/deno_json/',
      file: denoJson,
      keyPath: ['minimumDependencyAge'],
      message: `Set minimumDependencyAge (e.g. "P3D" for a ${RECOMMENDED_RELEASE_AGE_DAYS}-day cooldown) in deno.json.`,
      value: 'P3D',
    },
    npm: {
      accept: isPositiveNumber,
      docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age',
      file: npmrc,
      keyPath: ['min-release-age'],
      message: `Set min-release-age to ~${RECOMMENDED_RELEASE_AGE_DAYS} days to quarantine brand-new releases.`,
      value: RECOMMENDED_RELEASE_AGE_DAYS,
      versionNote: { configAvailableSince: 'npm 11.10.0' },
    },
    pnpm: {
      accept: isPositiveNumber,
      docs: 'https://pnpm.io/settings#minimumreleaseage',
      documentedDefault: DOCUMENTED_DEFAULT_MINUTES,
      file: pnpmWorkspace,
      keyPath: ['minimumReleaseAge'],
      // Why not bake the version string into `message`? It used to be inline
      // ("pnpm 11+ defaults..."); the structured versionNote keeps the body
      // about *what to do* and lets one renderer own the *when* across rules.
      message: `Set minimumReleaseAge (~${RECOMMENDED_RELEASE_AGE_MINUTES} minutes for a 3-day cooldown) in pnpm-workspace.yaml.`,
      value: RECOMMENDED_RELEASE_AGE_MINUTES,
      versionNote: {
        configAvailableSince: 'pnpm 10.16.0',
        defaultSafeSince: 'pnpm 11.0.0 (1440 minutes)',
      },
    },
    yarn: {
      accept: isPositiveNumber,
      docs: 'https://yarnpkg.com/configuration/yarnrc#npmMinimalAgeGate',
      documentedDefault: DOCUMENTED_DEFAULT_MINUTES,
      file: yarnrc,
      keyPath: ['npmMinimalAgeGate'],
      message: `Set npmMinimalAgeGate (~${RECOMMENDED_RELEASE_AGE_MINUTES} minutes for a 3-day cooldown) in .yarnrc.yml.`,
      value: RECOMMENDED_RELEASE_AGE_MINUTES,
      versionNote: {
        configAvailableSince: 'yarn 4.10.0',
        defaultSafeSince: 'yarn 4.15.0 (1440 minutes)',
      },
    },
  },
  description:
    'Refuse to install releases newer than a cooldown window so freshly published (possibly compromised) versions are skipped.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#set-minimal-release-age',
  id: 'minimum-release-age',
  severity: 'warn',
  title: 'Set a minimum release age',
});
