import { type AbsPath, type RelPath, asRelPath } from '../shared/paths.ts';
import { type PackageJson, safeParsePackageJson } from '../domain/schemas/package-json.ts';
import { nodeFileSystem, resolveIn, assertDirectory } from './node-file-system.ts';
import { ConfigError } from '../shared/errors.ts';
import { isPlainRecord } from '../shared/records.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import type { RepoContext } from '../domain/ports/repo-context.ts';
import type { ProjectType } from '../domain/entities/project-type.ts';

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

const parsePackageJson = (raw: string): PackageJson | undefined => {
  // trim() strips a leading U+FEFF BOM (per the ECMAScript whitespace
  // definition), matching how the json codec parses the same file and how
  // npm / pnpm / node's own require() treat BOM-prefixed package.json.
  const parsed = tryParseJson(raw.trim());
  if (!isPlainRecord(parsed)) {
    throw new ConfigError('package.json: expected an object at the root.');
  }
  return safeParsePackageJson(parsed);
};

export const createRepoContext = (
  root: AbsPath,
  fs: FileSystem = nodeFileSystem,
  projectType?: ProjectType,
): RepoContext => {
  if (fs === nodeFileSystem) assertDirectory(root);
  const readText = (relPath: RelPath): string | undefined => fs.readText(resolveIn(root, relPath));
  const exists = (relPath: RelPath): boolean => fs.exists(resolveIn(root, relPath));

  const raw = readText(asRelPath('package.json'));
  let packageJson: PackageJson | undefined = void 0;
  if (typeof raw !== 'undefined') {
    packageJson = parsePackageJson(raw);
  }

  return { exists, packageJson, projectType, readText, root };
};
