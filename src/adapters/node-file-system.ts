import { ConfigError, UsageError } from '../core/contracts/errors.ts';
import { type AbsPath, type RelPath } from '../core/contracts/paths.ts';
import { DEFAULT_SCAN_LIMITS, checkLimit, type ScanLimits } from '../core/contracts/scan-limits.ts';
import { nodePaths } from './node-paths.ts';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import type { FileSystem } from '../core/contracts/file-system.ts';
import { isNodeError } from './node-errors.ts';

/** Root ancestors are canonicalized; selected cwd and all below-root components must not be links. */
const strictPaths = (root: AbsPath) => {
  // A trailing separator makes lstat follow a directory link on POSIX.
  const selected = path.resolve(root);
  if (lstatSync(selected).isSymbolicLink())
    throw new ConfigError('Strict filesystem rejects a symlink cwd.');
  const canonical = realpathSync(selected);
  return (file: AbsPath) => {
    const relative = path.relative(root, file);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new ConfigError('Strict filesystem path escapes cwd.');
    let current = canonical;
    for (const component of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, component);
      if (lstatSync(current).isSymbolicLink())
        throw new ConfigError(`${file}: strict filesystem rejects symlinks.`);
    }
  };
};

/** Construct fresh native budgets for each inspection. No counters survive another scan. */
export const createNodeFileSystem = (
  limits: ScanLimits = DEFAULT_SCAN_LIMITS,
  strictRoot?: AbsPath,
): FileSystem => {
  const checkPath = strictRoot === undefined ? () => {} : strictPaths(strictRoot);
  let totalBytes = 0;
  let entries = 0;
  const regularFile = (file: AbsPath) => {
    checkPath(file);
    const stat = statSync(file);
    if (!stat.isFile()) throw new ConfigError(`${file}: expected a regular file.`);
    return stat;
  };
  return {
    readDirectories(directory) {
      checkPath(directory);
      const stream = opendirSync(directory);
      const names: string[] = [];
      try {
        for (let entry = stream.readSync(); entry !== null; entry = stream.readSync()) {
          checkLimit('maxEntries', ++entries, limits);
          if (entry.isDirectory()) names.push(entry.name);
        }
      } finally {
        stream.closeSync();
      }
      return names;
    },
    exists(file) {
      try {
        regularFile(file);
        return true;
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') return false;
        throw error;
      }
    },
    readText(file) {
      let fd: number | undefined;
      try {
        const stat = regularFile(file);
        checkLimit('maxFileBytes', stat.size, limits);
        checkLimit('maxTotalBytes', totalBytes + stat.size, limits);
        // NONBLOCK avoids waiting on a FIFO substituted after stat; NOFOLLOW protects the
        // final component where supported. Ancestor replacement still needs a sandbox.
        fd = openSync(
          file,
          constants.O_RDONLY |
            constants.O_NONBLOCK |
            (strictRoot === undefined ? 0 : (constants.O_NOFOLLOW ?? 0)),
        );
        if (!fstatSync(fd).isFile()) throw new ConfigError(`${file}: expected a regular file.`);
        const chunks: Buffer[] = [];
        let size = 0;
        for (;;) {
          const buffer = Buffer.allocUnsafe(
            Math.min(
              64 * 1024,
              limits.maxFileBytes - size + 1,
              limits.maxTotalBytes - totalBytes + 1,
            ),
          );
          const read = readSync(fd, buffer);
          if (read === 0) break;
          size += read;
          totalBytes += read;
          checkLimit('maxFileBytes', size, limits);
          checkLimit('maxTotalBytes', totalBytes, limits);
          chunks.push(buffer.subarray(0, read));
        }
        return Buffer.concat(chunks, size).toString('utf8');
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') return;
        throw error;
      } finally {
        if (fd !== undefined) closeSync(fd);
      }
    },
  };
};

// Standalone public adapter has per-operation limits, not process-lifetime counters.
export const nodeFileSystem: FileSystem = {
  readDirectories: (directory) => createNodeFileSystem().readDirectories(directory),
  exists: (file) => createNodeFileSystem().exists(file),
  readText: (file) => createNodeFileSystem().readText(file),
};
export const resolveIn = (root: AbsPath, relPath: RelPath): AbsPath =>
  nodePaths.resolve(root, relPath);
export const assertDirectory = (root: AbsPath): void => {
  if (!statSync(root).isDirectory()) throw new UsageError('The lint target must be a directory.');
};
