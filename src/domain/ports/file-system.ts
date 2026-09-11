import type { AbsPath } from '../../shared/paths.ts';

/** IO boundary: swap in memfs (or any other backend) for tests. */
export interface FileSystem {
  /** Ordinary child directory names, excluding symlinks. Required only for workspace discovery. Errors must propagate. */
  readDirectories?: (path: AbsPath) => readonly string[];
  /** Resolve one ordinary child using this filesystem's native name semantics, returning its enumerated name. No symlinks. Undefined for absence; other errors propagate. Without this optional port, Deno literal prefixes use exact names from readDirectories. */
  resolveDirectory?: (parent: AbsPath, name: string) => string | undefined;
  /** Read a regular file (including a symlink to one); undefined only for ENOENT. Other errors and non-file entries must throw. */
  readText: (path: AbsPath) => string | undefined;
  /** True for a regular file (including a symlink to one); false only for ENOENT. Other errors and non-file entries must throw. */
  exists: (path: AbsPath) => boolean;
}
