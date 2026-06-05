import { type AbsPath, type RelPath, asAbsPath } from '../shared/paths.ts';
import { accessSync, constants, readFileSync } from 'node:fs';
import type { FileSystem } from '../domain/ports/file-system.ts';
import { isNodeError } from './node-errors.ts';
import path from 'node:path';

// `existsSync` and bare catch-all `false`/`undefined` returns would mask
// EACCES, EISDIR, and friends as "not there" — fatal for a security linter,
// which would then silently skip a config it cannot read and report
// "no findings" on an unauthorized scan. Only ENOENT is translated to absent;
// every other errno propagates.
export const nodeFileSystem: FileSystem = {
  exists(filePath) {
    try {
      accessSync(filePath, constants.F_OK);
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  },
  readText(filePath) {
    try {
      return readFileSync(filePath, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  },
};

export const resolveIn = (root: AbsPath, relPath: RelPath): AbsPath =>
  asAbsPath(path.join(root, relPath));
