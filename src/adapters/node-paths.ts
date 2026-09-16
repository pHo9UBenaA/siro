import path from 'node:path';
import { type AbsPath, asRelPath } from '../shared/paths.ts';
import type { RepositoryPaths } from '../application/ports/lint-dependencies.ts';

const isAbsPath = (value: unknown): value is AbsPath =>
  typeof value === 'string' && !value.includes('\0') && path.isAbsolute(value);

export const asAbsPath = (value: string): AbsPath => {
  if (!isAbsPath(value)) throw new TypeError('Expected an absolute filesystem path.');
  return value;
};

export const nodePaths: RepositoryPaths = {
  isAbsolute: isAbsPath,
  resolve: (root, relative) => asAbsPath(path.join(root, asRelPath(relative))),
  normalizePattern: (pattern) => path.posix.normalize(pattern),
};
