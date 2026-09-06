import assert from 'node:assert/strict';
import type { CheckStatus } from '../../src/domain/entities/rule.ts';

export const automaticOperations = (status: CheckStatus) => {
  assert(
    status.state === 'violation' && status.remediation?.kind === 'automatic',
    'expected a violation with automatic remediation',
  );
  return status.remediation.operations;
};

export const manualSteps = (status: CheckStatus) =>
  status.state === 'violation' && status.remediation?.kind === 'manual'
    ? status.remediation.steps
    : undefined;
