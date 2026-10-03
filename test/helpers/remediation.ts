import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import type { CheckStatus } from '../../src/core/contracts/rule.ts';

export const automaticOperations = (status: CheckStatus) => {
  assert(
    status.state === 'violation' && status.remediation?.kind === 'automatic',
    `Expected automatic violation, received ${inspect(status)}`,
  );
  return status.remediation.operations;
};

export const manualSteps = (status: CheckStatus) => {
  assert(
    status.state === 'violation' && status.remediation?.kind === 'manual',
    `Expected manual violation, received ${inspect(status)}`,
  );
  return status.remediation.steps;
};
