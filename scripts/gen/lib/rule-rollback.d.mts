// Type-only sidecar for gen-rule-rollback.mjs (same .mjs-without-jiti
// rationale as script-runtime.d.mts).

export interface GenRuleWrite {
  readonly path: string;
  /**
   * `undefined` means the entry created a new file (rollback = unlink). Any other
   * value means the entry overwrote an existing file (rollback = restore).
   */
  readonly previousContent: string | undefined;
}

export interface RollbackFs {
  writeFileSync: (path: string, content: string) => void;
  unlinkSync: (path: string) => void;
}

export type RollbackReporter = (message: string) => void;

export function rollbackWrites(
  done: readonly GenRuleWrite[],
  fs: RollbackFs,
  report: RollbackReporter,
): void;
