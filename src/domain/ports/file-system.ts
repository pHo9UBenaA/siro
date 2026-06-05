import type { AbsPath } from '../../shared/paths.ts';

/** IO boundary: swap in memfs (or any other backend) for tests. */
export interface FileSystem {
  readText: (path: AbsPath) => string | undefined;
  exists: (path: AbsPath) => boolean;
}
