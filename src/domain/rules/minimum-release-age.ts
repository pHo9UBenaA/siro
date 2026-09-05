import { getByPath } from '../entities/config-value.ts';
import { proposeChanges } from './remediation.ts';
import type { RuleBinding } from '../entities/rule.ts';
import { isPlainRecord } from '../../shared/records.ts';
import { isStringList } from './config-predicates.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';

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
const DENO_DURATION =
  /^P(?=.*\d)(?:\d+(?:[.,]\d+)?Y)?(?:\d+(?:[.,]\d+)?M)?(?:\d+(?:[.,]\d+)?W)?(?:\d+(?:[.,]\d+)?D)?(?:T(?=\d)(?:\d+(?:[.,]\d+)?H)?(?:\d+(?:[.,]\d+)?M)?(?:\d+(?:[.,]\d+)?S)?)?$/u;
const DENO_ZERO_DURATION = /^P(?=.*\d)(?:0+(?:[.,]0+)?[YMWD])*(?:T(?:0+(?:[.,]0+)?[HMS])*)?$/u;
const DENO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DENO_RFC3339_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[Tt](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;
const DENO_DATE_LENGTH = 10;

const isPositiveNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isPositiveYarnDuration = (value: unknown): boolean =>
  isPositiveNumber(value) ||
  (typeof value === 'string' &&
    /^\d*\.?\d+(?:ms|s|m|h|d|w)?$/u.test(value) &&
    Number.isFinite(Number.parseFloat(value)) &&
    Number.parseFloat(value) > 0);

const isActiveDenoAge = (value: unknown): boolean => {
  if (typeof value === 'number') {
    return isPositiveNumber(value);
  }
  if (typeof value === 'string') {
    const isDuration = DENO_DURATION.test(value);
    const date = value.slice(0, DENO_DATE_LENGTH);
    const dateTimestamp = Date.parse(`${date}T00:00:00Z`);
    return (
      (/^\d+$/u.test(value) && Number.isFinite(Number(value)) && Number(value) > 0) ||
      (isDuration && !DENO_ZERO_DURATION.test(value)) ||
      (!isDuration &&
        (DENO_DATE.test(value) || DENO_RFC3339_TIMESTAMP.test(value)) &&
        !Number.isNaN(dateTimestamp) &&
        new Date(dateTimestamp).toISOString().slice(0, date.length) === date &&
        (DENO_DATE.test(value) || !Number.isNaN(Date.parse(value))))
    );
  }
  return false;
};

const isNonDisabledDenoDuration = (value: unknown): boolean => {
  if (!isPlainRecord(value)) return isActiveDenoAge(value);
  if (value.exclude !== undefined && !isStringList(value.exclude)) return false;
  return !Object.hasOwn(value, 'age') || isActiveDenoAge(value.age);
};

const baseRule = requireConfigKey({
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
    npm: {
      accept: (value: unknown): boolean => {
        if (typeof value !== 'number' && typeof value !== 'string') {
          return false;
        }
        const age = Number(value);
        return Number.isFinite(age) && age > 0;
      },
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
      message: `Set minimumReleaseAge (~${RECOMMENDED_RELEASE_AGE_MINUTES} minutes for a 3-day cooldown) in pnpm-workspace.yaml.`,
      value: RECOMMENDED_RELEASE_AGE_MINUTES,
      versionNote: {
        configAvailableSince: 'pnpm 10.16.0',
        defaultSafeSince: 'pnpm 11.0.0 (1440 minutes)',
      },
    },
    yarn: {
      accept: isPositiveYarnDuration,
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

const denoBinding: RuleBinding = {
  file: denoJson,
  docs: 'https://docs.deno.com/runtime/reference/deno_json/',
  versionNote: {
    defaultSafeSince: 'deno 2.9.0 (1440 minutes)',
    note: 'object age optional since deno 2.9.4',
  },
  check(_ctx, config) {
    const actual = getByPath(config, ['minimumDependencyAge']);
    if (isNonDisabledDenoDuration(actual)) return { state: 'ok' };
    const objectAge = isPlainRecord(actual);
    const invalidExclusions =
      objectAge && actual.exclude !== undefined && !isStringList(actual.exclude);
    return {
      state: 'violation',
      actual,
      expected: 'P3D',
      message: `Set minimumDependencyAge (e.g. "P3D" for a ${RECOMMENDED_RELEASE_AGE_DAYS}-day cooldown) in deno.json.`,
      ...(actual === undefined ? { severity: 'info' as const } : {}),
      remediation: invalidExclusions
        ? {
            kind: 'manual',
            steps: [
              'Make minimumDependencyAge.exclude a list of package names and set minimumDependencyAge.age to a positive duration.',
            ],
          }
        : proposeChanges(config, [
            {
              file: denoJson,
              op: 'setKey',
              keyPath: objectAge ? ['minimumDependencyAge', 'age'] : ['minimumDependencyAge'],
              value: 'P3D',
            },
          ]),
    };
  },
};

export const minimumReleaseAge = overrideBindings(baseRule, { deno: denoBinding });
