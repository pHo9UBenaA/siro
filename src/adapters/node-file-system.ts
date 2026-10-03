import { ConfigError, UsageError } from '../core/contracts/errors.ts';
import type { AbsPath } from '../core/contracts/paths.ts';
import { DEFAULT_SCAN_LIMITS, checkLimit, type ScanLimits } from '../core/contracts/scan-limits.ts';
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
const createStrictPathChecker = (root: AbsPath) => {
  // A trailing separator makes lstat follow a directory link on POSIX.
  const selectedRoot = path.resolve(root);
  if (lstatSync(selectedRoot).isSymbolicLink())
    throw new ConfigError('Strict filesystem rejects a symlink cwd.');
  const canonicalRoot = realpathSync(selectedRoot);
  return (file: AbsPath) => {
    const relative = path.relative(root, file);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new ConfigError('Strict filesystem path escapes cwd.');
    let current = canonicalRoot;
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
  const checkPath = strictRoot === undefined ? () => {} : createStrictPathChecker(strictRoot);
  const READ_CHUNK_BYTES = 64 * 1024;
  let totalBytesRead = 0;
  let directoryEntryCount = 0;
  const statRegularFile = (file: AbsPath) => {
    checkPath(file);
    const stat = statSync(file);
    if (!stat.isFile()) throw new ConfigError(`${file}: expected a regular file.`);
    return stat;
  };
  const openInputFile = (file: AbsPath): number | undefined => {
    try {
      const stat = statRegularFile(file);
      checkLimit('maxFileBytes', stat.size, limits);
      checkLimit('maxTotalBytes', totalBytesRead + stat.size, limits);
      // NONBLOCK avoids waiting on a FIFO substituted after stat; NOFOLLOW protects the
      // final component where supported. Ancestor replacement still needs a sandbox.
      return openSync(
        file,
        constants.O_RDONLY |
          constants.O_NONBLOCK |
          (strictRoot === undefined ? 0 : (constants.O_NOFOLLOW ?? 0)),
      );
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return;
      throw error;
    }
  };
  return {
    readDirectories(directory) {
      checkPath(directory);
      const stream = opendirSync(directory);
      const names: string[] = [];
      try {
        for (;;) {
          const entry = stream.readSync();
          if (entry === null) break;
          directoryEntryCount += 1;
          checkLimit('maxEntries', directoryEntryCount, limits);
          if (entry.isDirectory()) names.push(entry.name);
        }
      } finally {
        stream.closeSync();
      }
      return names;
    },
    exists(file) {
      try {
        statRegularFile(file);
        return true;
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') return false;
        throw error;
      }
    },
    readText(file) {
      const fd = openInputFile(file);
      if (fd === undefined) return;
      try {
        if (!fstatSync(fd).isFile()) throw new ConfigError(`${file}: expected a regular file.`);
        const chunks: Buffer[] = [];
        let fileBytesRead = 0;
        for (;;) {
          // Read one byte past the remaining budget to detect growth after stat.
          const remainingFileBytes = limits.maxFileBytes - fileBytesRead;
          const remainingTotalBytes = limits.maxTotalBytes - totalBytesRead;
          const nextReadBytes = Math.min(
            READ_CHUNK_BYTES,
            remainingFileBytes + 1,
            remainingTotalBytes + 1,
          );
          const buffer = Buffer.allocUnsafe(nextReadBytes);
          const bytesRead = readSync(fd, buffer);
          if (bytesRead === 0) break;
          fileBytesRead += bytesRead;
          totalBytesRead += bytesRead;
          checkLimit('maxFileBytes', fileBytesRead, limits);
          checkLimit('maxTotalBytes', totalBytesRead, limits);
          chunks.push(buffer.subarray(0, bytesRead));
        }
        return Buffer.concat(chunks, fileBytesRead).toString('utf8');
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') return;
        throw error;
      } finally {
        closeSync(fd);
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
export const assertDirectory = (root: AbsPath): void => {
  if (!statSync(root).isDirectory()) throw new UsageError('The lint target must be a directory.');
};
