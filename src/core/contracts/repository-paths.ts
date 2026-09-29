import type { AbsPath, RelPath } from './paths.ts';

/** Native roots and repository-relative POSIX patterns have distinct semantics. */
export interface RepositoryPaths {
  isAbsolute: (value: unknown) => value is AbsPath;
  resolve: (root: AbsPath, relative: RelPath) => AbsPath;
  /** Validate one native ordinary child name and append without changing its spelling. */
  child: (parent: RelPath, name: unknown) => RelPath;
}
