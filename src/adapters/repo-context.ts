import { type AbsPath, type RelPath, asRelPath } from '../core/contracts/paths.ts';
import { type PackageJson, parsePackageJson } from '../core/contracts/package-json.ts';
import { nodeFileSystem, resolveIn, assertDirectory } from './node-file-system.ts';
import { ConfigError } from '../core/contracts/errors.ts';
import type { FileSystem } from '../core/contracts/file-system.ts';
import type { RepoContext } from '../core/contracts/repo-context.ts';
import type { ProjectType } from '../core/contracts/project-type.ts';

const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    let errMsg = String(error);
    if (error instanceof Error) {
      errMsg = error.message;
    }
    throw new ConfigError(`package.json: invalid JSON — ${errMsg}`);
  }
};

const readPackageJson = (raw: string): PackageJson => {
  // trim() strips a leading U+FEFF BOM (per the ECMAScript whitespace
  // definition), matching how the json codec parses the same file and how
  // npm / pnpm / node's own require() treat BOM-prefixed package.json.
  const parsed = tryParseJson(raw.trim());
  return parsePackageJson(parsed);
};

export const createRepoContext = (
  root: AbsPath,
  fs: FileSystem = nodeFileSystem,
  projectType?: ProjectType,
): RepoContext => {
  if (fs === nodeFileSystem) assertDirectory(root);
  const packageFile = resolveIn(root, asRelPath('package.json'));
  // The manifest and a rule's JSON codec must see the same bytes within this context.
  // Other paths remain live reads; this is not a repository-wide FS snapshot.
  const raw = fs.readText(packageFile);
  const readText = (relPath: RelPath): string | undefined => {
    const file = resolveIn(root, relPath);
    return file === packageFile ? raw : fs.readText(file);
  };
  const exists = (relPath: RelPath): boolean => fs.exists(resolveIn(root, relPath));
  let packageJson: PackageJson | undefined = void 0;
  if (typeof raw !== 'undefined') {
    packageJson = readPackageJson(raw);
  }

  return { exists, packageJson, projectType, readText, root };
};
