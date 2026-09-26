import type { RepositoryPaths } from './repository-paths.ts';
import type { Rule } from './rule.ts';
import type { WorkspaceGlobs } from './workspace-glob.ts';
import type { AbsPath } from './paths.ts';
import type { FileSystem } from './file-system.ts';
import type { RepoContext } from './repo-context.ts';
import type { ProjectType } from './project-type.ts';
import type { CodecFor } from './config-codec.ts';

/** Supplied by the host; the application never selects a runtime implementation. */
export interface LintDependencies {
  readonly rules: readonly Rule[];
  readonly fileSystem: FileSystem;
  readonly paths: RepositoryPaths;
  readonly codecFor: CodecFor;
  readonly globs: WorkspaceGlobs;
  /** Preserve the host's PM glob policy, independently of literal directory lookup. */
  readonly caseInsensitiveGlobs: boolean;
  readonly createRepoContext: (
    root: AbsPath,
    fs: FileSystem,
    projectType?: ProjectType,
  ) => RepoContext;
}
