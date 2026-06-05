/**
 * Single source of truth for package managers and severities.
 * Types, runtime sets, and ordering are all derived from these tuples — add a
 * package manager here and the rest of the codebase follows.
 */

export const PMS = ['npm', 'pnpm', 'yarn', 'bun', 'deno', 'aube'] as const;
export type PM = (typeof PMS)[number];

export const SEVERITIES = ['error', 'warn', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * Numeric ordering of severities for threshold comparisons. Co-located with
 * `Severity` so `filter`, `runLint`, and any future severity-aware code share
 * one source of truth — drifting the order in one place silently changes the
 * fail-on-threshold contract everywhere.
 */
export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  error: 3,
  info: 1,
  warn: 2,
};

const PM_SET: ReadonlySet<string> = new Set(PMS);
const SEVERITY_SET: ReadonlySet<string> = new Set(SEVERITIES);

export const isPM = (value: string): value is PM => PM_SET.has(value);

export const isSeverity = (value: string): value is Severity => SEVERITY_SET.has(value);

const PACKAGE_MANAGER_FIELD = /^(?<pmName>[a-z]+)(?:@.+)?$/u;

export const parsePackageManagerField = (value: string): PM | undefined => {
  const match = PACKAGE_MANAGER_FIELD.exec(value.trim());
  let name: string | undefined = void 0;
  if (match && match.groups) {
    name = match.groups.pmName;
  }
  if (typeof name !== 'undefined' && isPM(name)) {
    return name;
  }
  return void 0;
};
