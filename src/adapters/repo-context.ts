import { type AbsPath, type RelPath, asRelPath } from '../core/contracts/paths.ts';
import { parsePackageJson } from '../core/contracts/package-json.ts';
import { nodePaths } from './node-paths.ts';
import { wrapCodecError } from '../core/contracts/errors.ts';
import { parseJson } from './codecs/json.ts';
import { DEFAULT_SCAN_LIMITS } from '../core/contracts/scan-limits.ts';
import type { FileSystem } from '../core/contracts/file-system.ts';
import type { RepoContext } from '../core/contracts/repo-context.ts';
import type { ProjectType } from '../core/contracts/project-type.ts';

/** Read caching and budgets belong to the scan's supplied filesystem. */
export const createRepoContext = (
  root: AbsPath,
  fs: FileSystem,
  projectType?: ProjectType,
  maxDepth = DEFAULT_SCAN_LIMITS.maxConfigDepth,
): RepoContext => {
  const readText = (relative: RelPath) => fs.readText(nodePaths.resolve(root, relative));
  const raw = readText(asRelPath('package.json'));
  const packageJson =
    raw === undefined
      ? undefined
      : parsePackageJson(wrapCodecError('package.json', () => parseJson(raw, maxDepth)));
  const exists = (relative: RelPath) => fs.exists(nodePaths.resolve(root, relative));
  return { exists, packageJson, projectType, readText, root };
};
