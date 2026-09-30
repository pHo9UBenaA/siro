import { type AbsPath, type RelPath, asRelPath } from '../core/contracts/paths.ts';
import { type PackageJson, parsePackageJson } from '../core/contracts/package-json.ts';
import { nodeFileSystem, resolveIn, assertDirectory } from './node-file-system.ts';
import { wrapCodecError } from '../core/contracts/errors.ts';
import { parseJson } from './codecs/json.ts';
import { DEFAULT_SCAN_LIMITS } from '../core/contracts/scan-limits.ts';
import type { FileSystem } from '../core/contracts/file-system.ts';
import type { RepoContext } from '../core/contracts/repo-context.ts';
import type { ProjectType } from '../core/contracts/project-type.ts';

const readPackageJson = (raw: string, maxDepth: number): PackageJson => {
  // trim() strips a leading U+FEFF BOM (per the ECMAScript whitespace
  // definition), matching how the json codec parses the same file and how
  // npm / pnpm / node's own require() treat BOM-prefixed package.json.
  const parsed = wrapCodecError('package.json', () => parseJson(raw, maxDepth));
  return parsePackageJson(parsed);
};

export const createRepoContext = (
  root: AbsPath,
  fs: FileSystem = nodeFileSystem,
  projectType?: ProjectType,
  maxDepth = DEFAULT_SCAN_LIMITS.maxConfigDepth,
): RepoContext => {
  if (fs === nodeFileSystem) assertDirectory(root);
  const packageFile = resolveIn(root, asRelPath('package.json'));
  // The manifest and a rule's JSON codec must see the same bytes within this context.
  // Successful reads (including absence) belong to this context, not a global snapshot.
  const raw = fs.readText(packageFile);
  const texts = new Map<AbsPath, string | undefined>([[packageFile, raw]]);
  const readText = (relPath: RelPath): string | undefined => {
    const file = resolveIn(root, relPath);
    if (!texts.has(file)) texts.set(file, fs.readText(file));
    return texts.get(file);
  };
  const exists = (relPath: RelPath): boolean => fs.exists(resolveIn(root, relPath));
  let packageJson: PackageJson | undefined = void 0;
  if (typeof raw !== 'undefined') {
    packageJson = readPackageJson(raw, maxDepth);
  }

  return { exists, packageJson, projectType, readText, root };
};
