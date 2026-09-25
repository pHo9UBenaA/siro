import type { LintDependencies } from './ports/lint-dependencies.ts';
import type { WorkspaceGlob, WorkspaceGlobs } from './ports/workspace-glob.ts';
import { CONFIG_FILES } from '../domain/entities/config-files.ts';
import type { PM } from '../domain/entities/pms.ts';
import type { RepoContext } from '../domain/ports/repo-context.ts';
import { createConfigParser } from '../domain/services/parse-config-file.ts';
import { ConfigError } from '../shared/errors.ts';
import { isRelPath } from '../shared/paths.ts';
import { isPlainRecord } from '../shared/records.ts';

/** npm cancels an earlier exclusion when a later positive pattern matches it. */
const splitNpmPattern = (raw: string) => {
  const prefix = /^!+/u.exec(raw)?.[0] ?? '';
  return { excluded: prefix.length % 2 === 1, pattern: raw.slice(prefix.length) };
};

const npmPatterns = (patterns: readonly string[], globs: WorkspaceGlobs): readonly string[] => {
  const positive: string[] = [];
  let negative: { pattern: string; glob: WorkspaceGlob }[] = [];
  for (const raw of patterns) {
    const parsed = splitNpmPattern(raw);
    const pattern = parsed.pattern.replace(/^\.?\/+/u, '');
    if (parsed.excluded) {
      // npm compares declaration strings with its shell-pattern semantics,
      // independently of the platform policy used to enumerate directories.
      negative.push({ pattern, glob: globs.compile(pattern, { kind: 'declaration' }) });
    } else {
      // Match @npmcli/map-workspaces' forward splice exactly. Adjacent duplicate
      // exclusions are not all removed because the shifted entry is skipped.
      for (let index = 0; index < negative.length; index += 1) {
        if (negative[index]?.glob.matches(pattern)) negative.splice(index, 1);
      }
      positive.push(pattern);
    }
  }
  return [...positive, ...negative.map(({ pattern }) => `!${pattern}`)];
};

export interface WorkspaceDefinition {
  readonly patterns: readonly string[];
  readonly denoManifests: boolean;
}

/** Read declaration sources separately so Deno's two manifest sets stay distinct. */
export const workspaceDefinitions = (
  ctx: RepoContext,
  pm: PM,
  dependencies: LintDependencies,
): readonly WorkspaceDefinition[] => {
  const { codecFor, paths, globs } = dependencies;
  const parse = createConfigParser(codecFor, ctx);
  const validate = (value: unknown, source: string, denoManifests = false): WorkspaceDefinition => {
    if (value === undefined) return { patterns: [], denoManifests };
    if (!Array.isArray(value) || !Array.from(value).every((item) => typeof item === 'string')) {
      throw new ConfigError(`${source}: expected an array of directory patterns.`);
    }
    for (const pattern of value) {
      const positive =
        pm === 'npm'
          ? splitNpmPattern(pattern).pattern
          : pattern.startsWith('!')
            ? pattern.slice(1)
            : pattern;
      const alternatives = pm === 'deno' || pm === 'aube' ? [positive] : globs.expand(positive);
      if (
        alternatives.some(
          (alternative) =>
            !isRelPath(alternative) || alternative.includes('\\') || alternative.startsWith('!'),
        )
      ) {
        throw new ConfigError(
          `${source}: use relative directory patterns without parent traversal: ${JSON.stringify(pattern)}.`,
        );
      }
      if (
        pm === 'deno' &&
        denoManifests &&
        !pattern.startsWith('!') &&
        paths.normalizePattern(positive) === '.'
      ) {
        throw new ConfigError(`${source}: a Deno workspace cannot contain itself.`);
      }
    }
    return { patterns: pm === 'npm' ? npmPatterns(value, globs) : value, denoManifests };
  };
  const packageDefinition = () => {
    let value = ctx.packageJson?.workspaces;
    if (isPlainRecord(value)) {
      value = value.packages;
      if (value === undefined)
        throw new ConfigError('package.json#workspaces: expected a packages array.');
    }
    return validate(value, 'package.json#workspaces');
  };
  if (pm === 'pnpm') {
    return [
      validate(
        ctx.exists(CONFIG_FILES.pnpmWorkspace.path)
          ? parse(CONFIG_FILES.pnpmWorkspace).packages
          : undefined,
        'pnpm-workspace.yaml#packages',
      ),
    ];
  }
  if (pm === 'aube') {
    const file = [CONFIG_FILES.aubeWorkspace, CONFIG_FILES.pnpmWorkspace].find((candidate) =>
      ctx.exists(candidate.path),
    );
    return [file ? validate(parse(file).packages, `${file.path}#packages`) : packageDefinition()];
  }
  if (pm === 'deno') {
    return [
      validate(parse(CONFIG_FILES.denoJson).workspace, 'deno.json#workspace', true),
      packageDefinition(),
    ];
  }
  return [packageDefinition()];
};
