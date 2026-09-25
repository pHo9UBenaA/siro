/** Matching and traversal must share the same compiled pattern semantics. */
export interface WorkspaceGlob {
  matches: (directory: string) => boolean;
  canDescend: (directory: string) => boolean;
}

/** PM policy expressed as matching behavior, without engine or OS switches. */
export type WorkspaceGlobOptions =
  // npm compares declaration strings before filesystem enumeration. This uses
  // case-sensitive shell syntax, including leading comments and negation.
  | { readonly kind: 'declaration' }
  | {
      readonly kind: 'directory';
      /** shell: braces/classes/extglobs; wildcards: only *, ? and whole-segment **. */
      readonly syntax: 'shell' | 'wildcards';
      readonly caseInsensitive: boolean;
      readonly includeDotDirectories?: boolean;
      /** Treat leading # as a comment. Directory patterns are otherwise literal. */
      readonly hashComments?: boolean;
      /** Disable shell extglobs for PMs that treat that punctuation literally. */
      readonly extendedPatterns?: boolean;
    };

export interface WorkspaceGlobs {
  /** Reject excessive expansion and invalid syntax with ConfigError. */
  expand: (pattern: string) => readonly string[];
  compile: (pattern: string, options: WorkspaceGlobOptions) => WorkspaceGlob;
}
