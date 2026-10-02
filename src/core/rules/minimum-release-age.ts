import type { DateTime } from '../contracts/date-time.ts';
import { guardRemediationAvailability } from './remediation-availability.ts';
import { isActiveDenoReleaseAge } from './deno-release-age.ts';
import { getByPath } from '../contracts/config-value.ts';
import { proposeChanges } from './remediation.ts';
import type { RuleBinding, ViolationStatus } from '../contracts/rule.ts';
import { isPlainRecord } from '../contracts/records.ts';
import { isNonBlankStringArray } from './config-predicates.ts';
import { CONFIG_FILES } from '../config-files.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const SECONDS_PER_DAY = MINUTES_PER_DAY * SECONDS_PER_MINUTE;
const RECOMMENDED_RELEASE_AGE_DAYS = 3;
const RECOMMENDED_RELEASE_AGE_MINUTES = RECOMMENDED_RELEASE_AGE_DAYS * MINUTES_PER_DAY;
const RECOMMENDED_RELEASE_AGE_SECONDS = RECOMMENDED_RELEASE_AGE_DAYS * SECONDS_PER_DAY;
const DOCUMENTED_DEFAULT_MINUTES = MINUTES_PER_DAY;

const { npmrc, pnpmWorkspace, yarnrc, bunfig, denoJson, aubeWorkspace } = CONFIG_FILES;

const isPositiveNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isPositiveYarnDuration = (value: unknown): boolean => {
  if (isPositiveNumber(value)) return true;
  if (typeof value !== 'string' || !/^\d*\.?\d+(?:ms|s|m|h|d|w)?$/u.test(value)) return false;
  const durationAmount = Number.parseFloat(value);
  return Number.isFinite(durationAmount) && durationAmount > 0;
};

const isPositiveDenoNpmrcDays = (
  value: unknown,
  nowMs: number,
  parse: DateTime['parse'],
): boolean =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  isActiveDenoReleaseAge(value * MINUTES_PER_DAY, nowMs, parse);

const baseRule = requireConfigKey({
  bindings: {
    aube: {
      accept: isPositiveNumber,
      docs: 'https://aube.sh/settings/',
      documentedDefault: DOCUMENTED_DEFAULT_MINUTES,
      defaultSafety: 'unconditional',
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
      docs: 'https://pnpm.io/settings/dependency-resolution#minimumreleaseage',
      documentedDefault: DOCUMENTED_DEFAULT_MINUTES,
      defaultSafety: 'conditional',
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
      defaultSafety: 'conditional',
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
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#2-set-cooldowns--minimum-release-age',
  id: 'minimum-release-age',
  severity: 'warn',
  title: 'Set a minimum release age',
});

const createNpmBinding = (time: DateTime): RuleBinding => ({
  file: npmrc,
  docs: 'https://docs.npmjs.com/cli/v12/using-npm/config#min-release-age',
  versionNote: { note: 'min-release-age available since npm 11.10.0' },
  check(ctx, config) {
    const nowMs = time.now();
    // npm gives an explicit before priority over min-release-age in the same source.
    if (Object.hasOwn(config, 'before')) {
      const actual = config.before;
      if (
        (typeof actual === 'string' || typeof actual === 'number') &&
        time.parse(String(actual)) < nowMs
      ) {
        return { state: 'ok' };
      }
      const alternative = guardRemediationAvailability(
        'npm',
        ctx.pmVersion,
        {
          kind: 'manual',
          steps: [
            `Alternatively, remove before and set min-release-age to ~${RECOMMENDED_RELEASE_AGE_DAYS} days.`,
          ],
        },
        [{ file: npmrc, keyPath: ['min-release-age'] }],
      );
      return {
        state: 'violation',
        actual,
        expected: 'a date in the past',
        message: 'Use a valid past before cutoff, or remove before and set min-release-age.',
        remediation: {
          kind: 'manual',
          steps: [
            'In .npmrc, set before to a valid past date. A future or disabled before overrides min-release-age in this file.',
            ...(alternative?.steps ?? []),
          ],
        },
      };
    }
    const actual = getByPath(config, ['min-release-age']);
    const ageDays = typeof actual === 'number' || typeof actual === 'string' ? Number(actual) : NaN;
    const cutoffMs = new Date(nowMs - SECONDS_PER_DAY * 1000 * ageDays).valueOf();
    if (ageDays > 0 && Number.isFinite(cutoffMs) && cutoffMs < nowMs) return { state: 'ok' };
    return {
      state: 'violation',
      actual,
      expected: RECOMMENDED_RELEASE_AGE_DAYS,
      message: `Set min-release-age to ~${RECOMMENDED_RELEASE_AGE_DAYS} days to quarantine brand-new releases.`,
      remediation: guardRemediationAvailability(
        'npm',
        ctx.pmVersion,
        proposeChanges(config, [
          {
            file: npmrc,
            op: 'setKey',
            keyPath: ['min-release-age'],
            value: RECOMMENDED_RELEASE_AGE_DAYS,
          },
        ]),
        [{ file: npmrc, keyPath: ['min-release-age'] }],
      ),
    };
  },
});

const createDenoBinding = (time: DateTime): RuleBinding => ({
  file: denoJson,
  docs: 'https://docs.deno.com/runtime/reference/deno_json/',
  versionNote: {
    defaultSafeSince: 'deno 2.9.0 (1440 minutes)',
    note: 'object age may be omitted; project .npmrc fallback available since deno 2.8.1',
  },
  check(ctx, config) {
    const actual = getByPath(config, ['minimumDependencyAge']);
    const nowMs = time.now();
    const violation: ViolationStatus = {
      state: 'violation',
      actual,
      expected: 'P3D',
      message: `Set minimumDependencyAge (e.g. "P3D" for a ${RECOMMENDED_RELEASE_AGE_DAYS}-day cooldown) in deno.json.`,
    };
    const objectAge = isPlainRecord(actual);
    if (
      objectAge &&
      (Object.keys(actual).some((key) => key !== 'age' && key !== 'exclude') ||
        (actual.exclude !== undefined && !isNonBlankStringArray(actual.exclude)))
    ) {
      return {
        ...violation,
        remediation: {
          kind: 'manual',
          steps: [
            'Use only age and exclude in minimumDependencyAge. Make exclude a list of package names and set age to a positive supported duration.',
          ],
        },
      };
    }
    const age = objectAge ? actual.age : actual;
    if (age == null) {
      const npmrcConfig = ctx.readConfig(npmrc);
      const npmrcAge = getByPath(npmrcConfig, ['min-release-age']);
      if (isPositiveDenoNpmrcDays(npmrcAge, nowMs, time.parse)) return { state: 'ok' };
      // Deno treats zero as an explicit opt-out. Do not let an omitted object
      // age fall through to the version-dependent default in that case.
      if (npmrcAge === 0) {
        return {
          state: 'violation',
          actual: npmrcAge,
          expected: RECOMMENDED_RELEASE_AGE_DAYS,
          file: npmrc.path,
          message: `Set min-release-age to ~${RECOMMENDED_RELEASE_AGE_DAYS} days in .npmrc, or set minimumDependencyAge in deno.json.`,
          remediation: proposeChanges(npmrcConfig, [
            {
              file: npmrc,
              op: 'setKey',
              keyPath: ['min-release-age'],
              value: RECOMMENDED_RELEASE_AGE_DAYS,
            },
          ]),
        };
      }
    }
    if (isActiveDenoReleaseAge(age, nowMs, time.parse)) return { state: 'ok' };
    return {
      ...violation,
      remediation: proposeChanges(config, [
        {
          file: denoJson,
          op: 'setKey',
          keyPath: objectAge ? ['minimumDependencyAge', 'age'] : ['minimumDependencyAge'],
          value: 'P3D',
        },
      ]),
    };
  },
});

export const createMinimumReleaseAge = (time: DateTime) =>
  overrideBindings(baseRule, { npm: createNpmBinding(time), deno: createDenoBinding(time) });
