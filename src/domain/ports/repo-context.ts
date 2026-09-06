import type { ConfigFileRef } from '../entities/rule.ts';
import type { ParsedConfig } from '../entities/config-value.ts';
import type { AbsPath, RelPath } from '../../shared/paths.ts';
import type { PackageJson } from '../schemas/package-json.ts';
import type { ProjectType } from '../entities/project-type.ts';

/** Read-only view of a repository, passed to every rule's `check`. */
export interface RepoContext {
  readonly root: AbsPath;
  exists: (relPath: RelPath) => boolean;
  readText: (relPath: RelPath) => string | undefined;
  readonly packageJson: PackageJson | undefined;
  readonly projectType?: ProjectType;
}

/** Settings read during one evaluation share its parser and cache. */
export interface RuleContext extends RepoContext {
  readConfig: (file: ConfigFileRef) => ParsedConfig;
}
