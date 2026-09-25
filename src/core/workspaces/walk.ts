import type { LintDependencies } from '../contracts/lint-dependencies.ts';
import type { WorkspaceDefinition } from './declarations.ts';
import { createWorkspaceSelection } from './selection.ts';
import type { PM } from '../contracts/pms.ts';
import type { FileSystem } from '../contracts/file-system.ts';
import type { RepoContext } from '../contracts/repo-context.ts';
import type { ConfigParser } from '../parse-config-file.ts';
import { ConfigError, UsageError } from '../contracts/errors.ts';
import { asRelPath, isRelPath, type RelPath } from '../contracts/paths.ts';

interface WorkspaceMatch {
  readonly directory: RelPath;
  readonly explicitMember: boolean;
}

/** Traverse ordinary directories through the supplied filesystem, never the host filesystem. */
export const workspaceDirectories = (
  ctx: RepoContext,
  fs: FileSystem,
  definition: WorkspaceDefinition,
  pm: PM,
  dependencies: Pick<LintDependencies, 'paths' | 'globs' | 'caseInsensitiveGlobs'>,
  parseConfig: ConfigParser,
): readonly WorkspaceMatch[] => {
  const { paths } = dependencies;
  const directoryCache = new Map<string, readonly string[]>();
  const readDirectories = (directory: string): readonly string[] => {
    const cached = directoryCache.get(directory);
    if (cached) return cached;
    if (!fs.readDirectories)
      throw new UsageError(
        'Workspace discovery requires FileSystem.readDirectories; no host filesystem fallback is used.',
      );
    const names = fs.readDirectories(paths.resolve(ctx.root, asRelPath(directory)));
    if (!Array.isArray(names))
      throw new ConfigError('FileSystem.readDirectories must return an array of directory names.');
    for (const name of Array.from(names)) {
      if (!isRelPath(name) || name === '.' || name === '..' || /[\\/]/u.test(name)) {
        throw new ConfigError(
          'FileSystem.readDirectories returned an invalid child directory name.',
        );
      }
    }
    const result = [...new Set(names)].sort();
    directoryCache.set(directory, result);
    return result;
  };
  const resolveChild = (parent: string, name: string): string | undefined => {
    if (name === '.git' || name === 'node_modules') return undefined;
    const names = readDirectories(parent);
    const resolved = names.includes(name)
      ? name
      : fs.resolveDirectory?.(paths.resolve(ctx.root, asRelPath(parent)), name);
    if (resolved !== undefined && !names.includes(resolved)) {
      throw new ConfigError(
        'FileSystem.resolveDirectory must return an enumerated ordinary child directory name.',
      );
    }
    return resolved === '.git' || resolved === 'node_modules' ? undefined : resolved;
  };
  const selection = createWorkspaceSelection(
    definition,
    pm,
    dependencies,
    parseConfig,
    resolveChild,
  );
  if (!selection) return [];
  if (!fs.readDirectories)
    throw new UsageError(
      'Workspace discovery requires FileSystem.readDirectories; no host filesystem fallback is used.',
    );
  const result: WorkspaceMatch[] = [];
  const pending = ['.'];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    for (const name of readDirectories(current)) {
      if (name === '.git' || name === 'node_modules') continue;
      const directory = asRelPath(current === '.' ? name : `${current}/${name}`);
      if (selection.skipDirectory(directory, name)) continue;
      if (selection.includes(directory))
        result.push({ directory, explicitMember: selection.isExplicitMember(directory) });
      // Fixed-depth declarations do not require opening member subdirectories.
      if (selection.canDescend(directory)) pending.push(directory);
    }
  }
  return result.sort((left, right) =>
    left.directory < right.directory ? -1 : left.directory > right.directory ? 1 : 0,
  );
};
