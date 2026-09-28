import { ConfigError } from './errors.ts';

/** Reject only the submitted async value, without a process-wide rejection handler. */
export const assertSynchronous = (value: unknown, label: string): void => {
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in value &&
    typeof value.then === 'function'
  ) {
    // Attach before throwing: rejecting an unsupported result must not leave its
    // rejection unobserved. This does not adopt async checks/config as a feature.
    void Promise.resolve(value).catch(() => {});
    throw new ConfigError(
      `${label} must be synchronous; Promise/thenable values are not supported.`,
    );
  }
};
