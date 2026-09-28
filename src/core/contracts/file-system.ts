import type { AbsPath } from './paths.ts';

/** IO boundary: swap in memfs (or any other backend) for tests. */
export interface FileSystem {
  /** Ordinary native child directory names, excluding symlinks. Required for recursive discovery. Errors must propagate. */
  readDirectories: (path: AbsPath) => readonly string[];
  /** Read a regular file (including a symlink to one); undefined only for ENOENT. Other errors and non-file entries must throw. */
  readText: (path: AbsPath) => string | undefined;
  /** True for a regular file (including a symlink to one); false only for ENOENT. Other errors and non-file entries must throw. */
  exists: (path: AbsPath) => boolean;
}
