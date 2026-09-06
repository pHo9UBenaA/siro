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

// Deno accepts weeks alone, integral days/hours/minutes, and fractional seconds.
// See denoland/deno v2.9.4, libs/config/util.rs. Months and years are unsupported.
const DENO_DURATION = /^\+?P(?:\+?\d+[Ww]|(?:\d+[Dd])*(?:T(?:\d+[HhMm]|\d+(?:\.\d+)?[Ss])+)?)$/u;
// Chrono's minimum date bounds the cutoff accepted by Deno.
const DENO_MIN_TIMESTAMP = Date.parse('-262143-01-01T00:00:00Z');
const DENO_UNIT_SECONDS: Readonly<Record<string, number>> = {
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
};

const DENO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DENO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[Tt ](?:[01]\d|2[0-3]):[0-5]\d:(?:[0-5]\d|60)(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;
const DENO_OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::(?:[0-5]\d|60))?[+-](?:[01]\d|2[0-3]):?[0-5]\d$/u;

const isPositiveNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isPositiveYarnDuration = (value: unknown): boolean =>
  isPositiveNumber(value) ||
  (typeof value === 'string' &&
    /^\d*\.?\d+(?:ms|s|m|h|d|w)?$/u.test(value) &&
    Number.isFinite(Number.parseFloat(value)) &&
    Number.parseFloat(value) > 0);

const isPositiveDenoSeconds = (seconds: number): boolean =>
  seconds > 0 && Number.isFinite(seconds) && Date.now() - seconds * 1000 >= DENO_MIN_TIMESTAMP;

const isActiveDenoAge = (value: unknown): boolean => {
  if (typeof value === 'number')
    return Number.isSafeInteger(value) && isPositiveDenoSeconds(value * 60);
  if (typeof value !== 'string') return false;
  if (/^\d+$/u.test(value))
    return Number.isSafeInteger(Number(value)) && isPositiveDenoSeconds(Number(value) * 60);
  if (DENO_DURATION.test(value)) {
    let seconds = 0;
    for (const [, integer, fraction, unit] of value.matchAll(/(\d+)(?:\.(\d+))?([WDHMS])/giu)) {
      // Sub-nanosecond fractional seconds are truncated by Deno.
      const amount = Number(integer) + Number(`0.${(fraction ?? '').slice(0, 9) || '0'}`);
      seconds += amount * (DENO_UNIT_SECONDS[unit?.toLowerCase() ?? ''] ?? 0);
    }
    return isPositiveDenoSeconds(seconds);
  }
  if (!DENO_DATE.test(value) && !DENO_TIMESTAMP.test(value) && !DENO_OFFSET_TIMESTAMP.test(value))
    return false;
  const date = value.slice(0, 10);
  const midnight = new Date(`${date}T00:00:00Z`);
  // Chrono accepts leap seconds; JavaScript Date does not. Normalize only that second.
  const leapSecond = /:60(?=\.|Z|z|[+-])/u.test(value);
  const timestamp =
    Date.parse(value.replace(/:60(?=\.|Z|z|[+-])/u, ':59')) + (leapSecond ? 1000 : 0);
  return (
    !Number.isNaN(midnight.valueOf()) &&
    midnight.toISOString().slice(0, 10) === date &&
    timestamp < Date.now()
  );
};

const isNonDisabledDenoDuration = (value: unknown): boolean => {
  if (!isPlainRecord(value)) return isActiveDenoAge(value);
  if (Object.keys(value).some((key) => key !== 'age' && key !== 'exclude')) return false;
  if (value.exclude !== undefined && !isStringList(value.exclude)) return false;
  return value.age == null || isActiveDenoAge(value.age);
};

const baseRule = requireConfigKey({
  bindings: {
    aube: {
      accept: isPositiveNumber,
      docs: 'https://aube.sh/settings/',
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

const npmBinding: RuleBinding = {
  file: npmrc,
  docs: 'https://docs.npmjs.com/cli/v12/using-npm/config#min-release-age',
  versionNote: { note: 'min-release-age available since npm 11.10.0' },
  check(_ctx, config) {
    const now = Date.now();
    // npm gives an explicit before priority over min-release-age in the same source.
    if (Object.hasOwn(config, 'before')) {
      const actual = config.before;
      if (
        (typeof actual === 'string' || typeof actual === 'number') &&
        Date.parse(String(actual)) < now
      ) {
        return { state: 'ok' };
      }
      return {
        state: 'violation',
        actual,
        expected: 'a date in the past',
        message: 'Use a valid past before cutoff, or remove before and set min-release-age.',
        remediation: {
          kind: 'manual',
          steps: [
            `In .npmrc, set before to a valid past date, or remove before and set min-release-age to ~${RECOMMENDED_RELEASE_AGE_DAYS} days. A future or disabled before overrides min-release-age in this file.`,
          ],
        },
      };
    }
    const actual = getByPath(config, ['min-release-age']);
    const age = typeof actual === 'number' || typeof actual === 'string' ? Number(actual) : NaN;
    const cutoff = new Date(now - SECONDS_PER_DAY * 1000 * age).valueOf();
    if (age > 0 && Number.isFinite(cutoff) && cutoff < now) return { state: 'ok' };
    return {
      state: 'violation',
      actual,
      expected: RECOMMENDED_RELEASE_AGE_DAYS,
      message: `Set min-release-age to ~${RECOMMENDED_RELEASE_AGE_DAYS} days to quarantine brand-new releases.`,
      remediation: proposeChanges(config, [
        {
          file: npmrc,
          op: 'setKey',
          keyPath: ['min-release-age'],
          value: RECOMMENDED_RELEASE_AGE_DAYS,
        },
      ]),
    };
  },
};

const denoBinding: RuleBinding = {
  file: denoJson,
  docs: 'https://docs.deno.com/runtime/reference/deno_json/',
  versionNote: {
    defaultSafeSince: 'deno 2.9.0 (1440 minutes)',
    note: 'object age may be omitted',
  },
  check(_ctx, config) {
    const actual = getByPath(config, ['minimumDependencyAge']);
    if (isNonDisabledDenoDuration(actual)) return { state: 'ok' };
    const objectAge = isPlainRecord(actual);
    const invalidObject =
      objectAge &&
      (Object.keys(actual).some((key) => key !== 'age' && key !== 'exclude') ||
        (actual.exclude !== undefined && !isStringList(actual.exclude)));
    return {
      state: 'violation',
      actual,
      expected: 'P3D',
      message: `Set minimumDependencyAge (e.g. "P3D" for a ${RECOMMENDED_RELEASE_AGE_DAYS}-day cooldown) in deno.json.`,
      ...(actual == null ? { severity: 'info' as const } : {}),
      remediation: invalidObject
        ? {
            kind: 'manual',
            steps: [
              'Use only age and exclude in minimumDependencyAge. Make exclude a list of package names and set age to a positive supported duration.',
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

export const minimumReleaseAge = overrideBindings(baseRule, { npm: npmBinding, deno: denoBinding });
