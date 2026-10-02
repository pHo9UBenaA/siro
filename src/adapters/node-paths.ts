import path from 'node:path';
import { type AbsPath, type RelPath } from '../core/contracts/paths.ts';
import { ConfigError } from '../core/contracts/errors.ts';
import type { RepositoryPaths } from '../core/contracts/repository-paths.ts';

const isAbsPath = (value: unknown): value is AbsPath =>
  typeof value === 'string' && !value.includes('\0') && path.isAbsolute(value);

export const asAbsPath = (value: string): AbsPath => {
  if (!isAbsPath(value)) throw new TypeError('Expected an absolute filesystem path.');
  return value;
};

export const nodePaths: RepositoryPaths = {
  isAbsolute: isAbsPath,
  resolve(root, relative) {
    // Native discovery paths may contain POSIX backslashes or colons. Do not
    // reinterpret them with portable user-input validation or slash replacement.
    if (
      typeof relative !== 'string' ||
      relative.includes('\0') ||
      path.isAbsolute(relative) ||
      relative.split(path.sep === '\\' ? /[\\/]/u : /\//u).includes('..')
    ) {
      throw new ConfigError(`Invalid repository-relative path: ${String(relative)}`);
    }
    const resolved = path.join(root, relative);
    const relativeToRoot = path.relative(root, resolved);
    if (
      relativeToRoot === '..' ||
      relativeToRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeToRoot)
    )
      throw new ConfigError('Path escapes repository root.');
    return asAbsPath(resolved);
  },
  child(parent, name) {
    if (
      typeof name !== 'string' ||
      !name ||
      name === '.' ||
      name === '..' ||
      name.includes('\0') ||
      name.includes('/') ||
      (path.sep === '\\' && (name.includes('\\') || name.includes(':')))
    ) {
      throw new ConfigError(
        `FileSystem.readDirectories returned an invalid child directory name: ${String(name)}`,
      );
    }
    // This brand is earned by host-native component validation, not user path parsing.
    return (parent === '.' ? name : `${parent}/${name}`) as RelPath;
  },
};
