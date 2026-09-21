import type { DateTime } from '../ports/date-time.ts';

// Deno accepts weeks alone, integral days/hours/minutes, and fractional seconds.
// See denoland/deno v2.9.4, libs/config/util.rs. Months and years are unsupported.
const DENO_DURATION = /^\+?P(?:\+?\d+[Ww]|(?:\d+[Dd])*(?:T(?:\d+[HhMm]|\d+(?:\.\d+)?[Ss])+)?)$/u;
// Chrono's minimum date bounds the cutoff accepted by Deno.
const DENO_MIN_TIMESTAMP = Date.UTC(-262143, 0, 1);
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
const DENO_DURATION_TOKEN = /(\d+)(?:\.(\d+))?([WDHMS])/giu;
const LEAP_SECOND = /:60(?=\.|Z|z|[+-])/u;

const isPositiveDenoSeconds = (seconds: number, now: number): boolean =>
  seconds > 0 && Number.isFinite(seconds) && now - seconds * 1000 >= DENO_MIN_TIMESTAMP;

const durationSeconds = (value: string): number => {
  let seconds = 0;
  for (const [, integer, fraction, unit] of value.matchAll(DENO_DURATION_TOKEN)) {
    // Sub-nanosecond fractional seconds are truncated by Deno.
    const amount = Number(integer) + Number(`0.${(fraction ?? '').slice(0, 9) || '0'}`);
    seconds += amount * (DENO_UNIT_SECONDS[unit?.toLowerCase() ?? ''] ?? 0);
  }
  return seconds;
};

/** Match Deno's minimumDependencyAge value grammar and active-cutoff semantics. */
export const isActiveDenoReleaseAge = (
  value: unknown,
  now: number,
  parse: DateTime['parse'],
): boolean => {
  if (typeof value === 'number')
    return Number.isSafeInteger(value) && isPositiveDenoSeconds(value * 60, now);
  if (typeof value !== 'string') return false;
  if (/^\d+$/u.test(value))
    return Number.isSafeInteger(Number(value)) && isPositiveDenoSeconds(Number(value) * 60, now);
  if (DENO_DURATION.test(value)) return isPositiveDenoSeconds(durationSeconds(value), now);
  if (!DENO_DATE.test(value) && !DENO_TIMESTAMP.test(value) && !DENO_OFFSET_TIMESTAMP.test(value))
    return false;

  const date = value.slice(0, 10);
  const midnight = new Date(`${date}T00:00:00Z`);
  // Chrono accepts leap seconds; JavaScript Date does not. Normalize only that second.
  const leapSecond = LEAP_SECOND.test(value);
  const timestamp = parse(value.replace(LEAP_SECOND, ':59')) + (leapSecond ? 1000 : 0);
  return (
    !Number.isNaN(midnight.valueOf()) &&
    midnight.toISOString().slice(0, 10) === date &&
    timestamp < now
  );
};
