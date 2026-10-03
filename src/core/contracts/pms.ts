/** Supported identifiers in stable evaluation/display order. */

export const PMS = ['npm', 'pnpm', 'yarn', 'bun', 'deno', 'aube'] as const;
export type PM = (typeof PMS)[number];

export const SEVERITIES = ['error', 'warn', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Numeric severity order for display filtering and failure thresholds. */
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
  const name = match?.groups?.pmName;
  if (typeof name !== 'undefined' && isPM(name)) {
    return name;
  }
  return undefined;
};
