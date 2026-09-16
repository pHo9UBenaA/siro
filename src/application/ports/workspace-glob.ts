/** Matching and traversal must share the same compiled pattern semantics. */
export interface WorkspaceGlob {
  matches: (directory: string) => boolean;
  canDescend: (directory: string) => boolean;
}

/** Only switches used by siro's PM dialect policies cross this boundary. */
export interface WorkspaceGlobOptions {
  readonly platform?: 'linux';
  readonly nocase?: boolean;
  readonly windowsPathsNoEscape?: boolean;
  readonly nonegate?: boolean;
  readonly nocomment?: boolean;
  readonly optimizationLevel?: 2;
  readonly nobrace?: boolean;
  readonly noext?: boolean;
  readonly dot?: boolean;
}

export interface WorkspaceGlobs {
  /** Reject excessive expansion and invalid syntax with ConfigError. */
  expand: (pattern: string) => readonly string[];
  compile: (pattern: string, options: WorkspaceGlobOptions) => WorkspaceGlob;
}
