import type { AbsPath, RelPath } from '../../shared/paths.ts';
import type { PackageJson } from '../schemas/package-json.ts';

/** Read-only view of a repository, passed to every rule's `check` and `fix`. */
export interface RepoContext {
  readonly root: AbsPath;
  exists: (relPath: RelPath) => boolean;
  readText: (relPath: RelPath) => string | undefined;
  readonly packageJson: PackageJson | undefined;
}
