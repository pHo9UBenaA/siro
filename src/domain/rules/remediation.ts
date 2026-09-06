import type { ParsedConfig } from '../entities/config-value.ts';
import type { Remediation, SetKeyOperation } from '../entities/rule.ts';
import { isPlainRecord } from '../../shared/records.ts';

/** Scalar writes must not discard an existing container or replace a non-object parent. */
export const proposeChanges = (
  config: ParsedConfig,
  operations: readonly [SetKeyOperation, ...SetKeyOperation[]],
): Remediation => {
  for (const operation of operations) {
    let current: unknown = config;
    for (const key of operation.keyPath) {
      if (current === undefined) break;
      if (!isPlainRecord(current)) {
        return {
          kind: 'manual',
          steps: [
            `Review ${operation.file.path}: ${operation.keyPath.join('.')} has a non-object parent. Restructure it before setting the value to ${JSON.stringify(operation.value)}.`,
          ],
        };
      }
      current = Object.hasOwn(current, key) ? current[key] : undefined;
    }
    if (current !== null && typeof current === 'object') {
      return {
        kind: 'manual',
        steps: [
          `Review ${operation.file.path}: ${operation.keyPath.join('.')} contains nested settings. Preserve the required entries when correcting this value.`,
        ],
      };
    }
  }
  return { kind: 'automatic', operations };
};
