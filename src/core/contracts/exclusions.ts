/** Compile siro's single case-sensitive directory exclusion dialect once per run. */
export type CompileExclusions = (patterns: readonly string[]) => (directory: string) => boolean;
