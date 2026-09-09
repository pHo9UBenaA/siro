import type { AbsPath } from '../../shared/paths.ts';

/** IO boundary: swap in memfs (or any other backend) for tests. */
export interface FileSystem {
  /** Ordinary child directory names, excluding symlinks. Required only for workspace discovery. Errors must propagate. */
  readDirectories?: (path: AbsPath) => readonly string[];
  readText: (path: AbsPath) => string | undefined;
  exists: (path: AbsPath) => boolean;
}
