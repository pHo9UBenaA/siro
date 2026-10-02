import { ConfigError, SiroError, UsageError } from './errors.ts';
import { isPlainRecord } from './records.ts';

/** Finite per-scan budgets, controlled by the caller, never repository config. */
export interface ScanLimits {
  readonly maxFileBytes: number;
  readonly maxTotalBytes: number;
  readonly maxEntries: number;
  readonly maxDirectories: number;
  readonly maxDirectoryDepth: number;
  readonly maxConfigDepth: number;
  readonly maxFindings: number;
  readonly maxOutputBytes: number;
}
export const DEFAULT_SCAN_LIMITS: Readonly<ScanLimits> = Object.freeze({
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  maxEntries: 100_000,
  maxDirectories: 10_000,
  maxDirectoryDepth: 128,
  maxConfigDepth: 128,
  maxFindings: 50_000,
  maxOutputBytes: 32 * 1024 * 1024,
});

export const resolveScanLimits = (input?: Partial<ScanLimits>): ScanLimits => {
  if (
    input !== undefined &&
    (!isPlainRecord(input) ||
      Object.keys(input).some((key) => !Object.hasOwn(DEFAULT_SCAN_LIMITS, key)))
  )
    throw new UsageError('limits must be an object of known scan limits.');
  const limits = { ...DEFAULT_SCAN_LIMITS, ...input };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new UsageError(`${key} must be a positive safe integer.`);
  }
  return limits;
};

const SCAN_SCOPE_ADVICE =
  'Reduce the scan scope. If the target contains independent projects, scan each project directory separately.';

export const checkLimit = (name: keyof ScanLimits, value: number, limits: ScanLimits): void => {
  if (value > limits[name]) {
    const advice =
      name === 'maxFileBytes' ? 'Reduce the size of the input file.' : SCAN_SCOPE_ADVICE;
    throw new ConfigError(`Inspection exceeds ${name} (${limits[name]}). ${advice}`);
  }
};

/** Counts UTF-8 without allocating another copy of a potentially large input. */
export const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
};

/** Iterative traversal; shared YAML mappings are legal, cycles are not. Root depth is 1. */
export const checkConfigDepth = (value: unknown, maxDepth: number): void => {
  const active = new Set<object>();
  const seen = new Map<object, number>();
  const pending: { value: unknown; depth: number; leave?: boolean }[] = [{ value, depth: 1 }];
  while (pending.length) {
    const item = pending.pop()!;
    if (item.value === null || typeof item.value !== 'object') continue;
    if (item.leave) {
      active.delete(item.value);
      continue;
    }
    if (active.has(item.value))
      throw new ConfigError('Configuration contains a circular reference.');
    if (item.depth > maxDepth)
      throw new ConfigError(
        `Configuration exceeds maxConfigDepth (${maxDepth}). Simplify the nesting of the configuration.`,
      );
    if ((seen.get(item.value) ?? 0) >= item.depth) continue;
    seen.set(item.value, item.depth);
    active.add(item.value);
    pending.push({ ...item, leave: true });
    for (const child of Object.values(item.value))
      pending.push({ value: child, depth: item.depth + 1 });
  }
};

/** Output budgets are output failures (70), not policy findings or incomplete input (2). */
export const outputBudget = (maxBytes: number) => {
  let bytes = 0;
  return (text: string): void => {
    bytes += utf8Bytes(text);
    if (bytes > maxBytes)
      throw new SiroError(`Output exceeds maxOutputBytes (${maxBytes}). ${SCAN_SCOPE_ADVICE}`, 70);
  };
};
