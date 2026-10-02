import type { DateTime } from '../contracts/date-time.ts';

// Deno accepts weeks alone, integral days/hours/minutes, and fractional seconds.
// See denoland/deno v2.9.4, libs/config/util.rs. Months and years are unsupported.
const DENO_DURATION = /^\+?P(?:\+?\d+[Ww]|(?:\d+[Dd])*(?:T(?:\d+[HhMm]|\d+(?:\.\d+)?[Ss])+)?)$/u;
// Chrono's minimum date bounds the cutoff accepted by Deno.
const DENO_MIN_TIMESTAMP_MS = Date.UTC(-262143, 0, 1);
const DENO_UNIT_SECONDS: Readonly<Record<string, number>> = {
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
};

const DENO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
// Full form: T/t/space separator, seconds required, optional fraction, Z/z or ±HH:MM.
const DENO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[Tt ](?:[01]\d|2[0-3]):[0-5]\d:(?:[0-5]\d|60)(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;
// Alternate form: optional seconds, ±HHMM or ±HH:MM, uppercase T, no fraction.
const DENO_OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::(?:[0-5]\d|60))?[+-](?:[01]\d|2[0-3]):?[0-5]\d$/u;
const DENO_DURATION_TOKEN = /(?<integer>\d+)(?:\.(?<fraction>\d+))?(?<unit>[WDHMS])/giu;
const LEAP_SECOND = /:60(?=\.|Z|z|[+-])/u;

const isActiveDurationSeconds = (seconds: number, nowMs: number): boolean =>
  seconds > 0 && Number.isFinite(seconds) && nowMs - seconds * 1000 >= DENO_MIN_TIMESTAMP_MS;

const durationSeconds = (value: string): number => {
  let seconds = 0;
  for (const token of value.matchAll(DENO_DURATION_TOKEN)) {
    const { integer, fraction, unit } = token.groups!;
    // Sub-nanosecond fractional seconds are truncated by Deno.
    const fractionDigits = (fraction ?? '').slice(0, 9) || '0';
    const amount = Number(integer) + Number(`0.${fractionDigits}`);
    const secondsPerUnit = DENO_UNIT_SECONDS[unit?.toLowerCase() ?? ''] ?? 0;
    seconds += amount * secondsPerUnit;
  }
  return seconds;
};

/** Match Deno's minimumDependencyAge value grammar and active-cutoff semantics. */
export const isActiveDenoReleaseAge = (
  value: unknown,
  nowMs: number,
  parse: DateTime['parse'],
): boolean => {
  if (typeof value === 'number')
    return Number.isSafeInteger(value) && isActiveDurationSeconds(value * 60, nowMs);
  if (typeof value !== 'string') return false;
  if (/^\d+$/u.test(value)) {
    const minutes = Number(value);
    return Number.isSafeInteger(minutes) && isActiveDurationSeconds(minutes * 60, nowMs);
  }
  if (DENO_DURATION.test(value)) return isActiveDurationSeconds(durationSeconds(value), nowMs);
  if (!DENO_DATE.test(value) && !DENO_TIMESTAMP.test(value) && !DENO_OFFSET_TIMESTAMP.test(value))
    return false;

  const calendarDate = value.slice(0, 10);
  const midnight = new Date(`${calendarDate}T00:00:00Z`);
  // Chrono accepts leap seconds; JavaScript Date does not. Normalize only that second.
  const hasLeapSecond = LEAP_SECOND.test(value);
  const timestampMs = parse(value.replace(LEAP_SECOND, ':59')) + (hasLeapSecond ? 1000 : 0);
  // Date normalizes impossible dates (e.g. February 30); Deno rejects them.
  const hasValidCalendarDate =
    !Number.isNaN(midnight.valueOf()) && midnight.toISOString().slice(0, 10) === calendarDate;
  return hasValidCalendarDate && timestampMs < nowMs;
};
