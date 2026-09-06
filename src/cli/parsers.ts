import {
  type PM,
  PMS,
  SEVERITIES,
  type Severity,
  isPM,
  isSeverity,
} from '../domain/entities/pms.ts';
import { PROJECT_TYPES, type ProjectType, isProjectType } from '../domain/entities/project-type.ts';
import { SUPPORTED_NODE_RANGE, isSupportedNodeVersion } from '../shared/node-version.ts';
import { UsageError } from '../shared/errors.ts';

export const parsePmFlag = (raw: unknown): PM | undefined => {
  if (typeof raw === 'undefined') {
    return;
  }
  if (raw === true) {
    throw new UsageError(`--pm requires a value (expected one of: ${PMS.join(', ')})`);
  }
  if (typeof raw !== 'string' || !isPM(raw)) {
    throw new UsageError(`Unknown package manager: ${raw} (expected one of: ${PMS.join(', ')})`);
  }
  return raw;
};

export const parseProjectTypeFlag = (raw: unknown): ProjectType | undefined => {
  if (typeof raw === 'undefined') {
    return;
  }
  if (raw === true) {
    throw new UsageError(`--project-type requires a value (expected ${PROJECT_TYPES.join('|')})`);
  }
  if (typeof raw === 'string' && isProjectType(raw)) {
    return raw;
  }
  throw new UsageError(
    `Unknown project type: ${String(raw)} (expected ${PROJECT_TYPES.join('|')})`,
  );
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

export const ensureNodeVersion = (nodeVersion: string): void => {
  if (!isSupportedNodeVersion(nodeVersion)) {
    throw new UsageError(
      `Node ${SUPPORTED_NODE_RANGE} required (you are on ${nodeVersion}). Upgrade your runtime to use siro.`,
    );
  }
};
