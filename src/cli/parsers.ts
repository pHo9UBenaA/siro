import {
  type PM,
  PMS,
  SEVERITIES,
  type Severity,
  isPM,
  isSeverity,
} from '../domain/entities/pms.ts';
import { BUILTIN_REPORTER_NAMES } from '../adapters/reporters/registry.ts';
import { UsageError } from '../shared/errors.ts';

const FIRST_INDEX = 0;
const MIN_NODE_MAJOR = 20;

export const rejectUnknownFlags = (
  flags: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  scope?: string,
): void => {
  for (const key of Object.keys(flags)) {
    if (!allowed.has(key)) {
      let where = '';
      if (scope) {
        where = ` for '${scope}'`;
      }
      throw new UsageError(`Unknown flag${where}: --${key}`);
    }
  }
};

export const parsePmFlag = (raw: unknown): PM | undefined => {
  if (typeof raw === 'undefined') {
    return;
  }
  if (raw === true) {
    // Cac yields `true` for a value flag whose value token is missing.
    throw new UsageError(`--pm requires a value (expected one of: ${PMS.join(', ')})`);
  }
  if (typeof raw !== 'string' || !isPM(raw)) {
    throw new UsageError(`Unknown package manager: ${raw} (expected one of: ${PMS.join(', ')})`);
  }
  return raw;
};

export const parseSeverityFlag = (raw: unknown): Severity | undefined => {
  if (typeof raw === 'undefined') {
    return;
  }
  if (raw === true) {
    throw new UsageError(`--severity requires a value (expected ${SEVERITIES.join('|')})`);
  }
  if (typeof raw !== 'string' || !isSeverity(raw)) {
    throw new UsageError(`Invalid severity: ${String(raw)} (expected ${SEVERITIES.join('|')})`);
  }
  return raw;
};

export const resolveReporter = (flags: Record<string, unknown>): string => {
  if (flags.reporter === true) {
    // Cac yields `true` when --reporter has no value token; falling through
    // Would silently select 'pretty', unlike --pm / --severity which reject.
    throw new UsageError(
      `--reporter requires a value (expected one of: ${BUILTIN_REPORTER_NAMES.join(', ')}, or a reporter registered via siro.config.ts)`,
    );
  }
  if (typeof flags.reporter === 'string') {
    // --reporter and --json both select a reporter; using both is ambiguous
    // Intent (even when redundant, e.g. `--reporter json --json`). Reject
    // Rather than silently letting one win.
    if (flags.json === true) {
      throw new UsageError('Use either --reporter or --json, not both.');
    }
    return flags.reporter;
  }
  if (flags.json === true) {
    return 'json';
  }
  return 'pretty';
};

export const ensureNodeVersion = (nodeVersion: string): void => {
  const major = Number(nodeVersion.replace(/^v/u, '').split('.')[FIRST_INDEX]);
  if (Number.isFinite(major) && major < MIN_NODE_MAJOR) {
    throw new UsageError(
      `Node ${MIN_NODE_MAJOR}+ required (you are on ${nodeVersion}). Upgrade your runtime to use siro.`,
    );
  }
};
