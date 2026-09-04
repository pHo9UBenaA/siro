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

export interface AtomicGenRuleWrite extends GenRuleWrite {
  readonly nextContent: string;
}

export interface AtomicWriteFs {
  renameSync: (oldPath: string, newPath: string) => void;
  unlinkSync: (path: string) => void;
  writeFileSync: (path: string, content: string, options: { readonly flag: 'wx' }) => void;
}

export interface RollbackFs {
  writeFileSync: (path: string, content: string) => void;
  unlinkSync: (path: string) => void;
}

export type RollbackReporter = (message: string) => void;

export function atomicWriteSync(
  write: AtomicGenRuleWrite,
  fs: AtomicWriteFs,
  tempPath: string,
): void;

export function rollbackWrites(
  done: readonly GenRuleWrite[],
  fs: RollbackFs,
  report: RollbackReporter,
): void;
