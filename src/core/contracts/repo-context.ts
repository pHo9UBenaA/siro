import type { ConfigFileRef } from './config-file-ref.ts';
import type { ParsedConfig } from './config-value.ts';
import type { AbsPath, RelPath } from './paths.ts';
import type { PackageJson } from './package-json.ts';
import type { ProjectType } from './project-type.ts';

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
  /** Declared or explicit stable version of this binding's manager, if known. */
  readonly pmVersion?: string;
  readConfig: (file: ConfigFileRef) => ParsedConfig;
}
