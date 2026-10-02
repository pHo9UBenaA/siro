import type { FileSystem } from './contracts/file-system.ts';
import type { AbsPath } from './contracts/paths.ts';
import { checkLimit, type ScanLimits, utf8Bytes } from './contracts/scan-limits.ts';

/** Bounds returned data from trusted injected IO; cannot bound allocations inside that IO. */
export const boundedFileSystem = (fs: FileSystem, limits: ScanLimits): FileSystem => {
  const textCache = new Map<AbsPath, string | undefined>();
  let totalTextBytes = 0;
  let returnedDirectoryCount = 0;
  return {
    exists: (path) => fs.exists(path),
    readText(path) {
      if (!textCache.has(path)) {
        const text = fs.readText(path);
        if (text !== undefined) {
          const size = utf8Bytes(text);
          checkLimit('maxFileBytes', size, limits);
          totalTextBytes += size;
          checkLimit('maxTotalBytes', totalTextBytes, limits);
        }
        textCache.set(path, text);
      }
      return textCache.get(path);
    },
    readDirectories(path) {
      const names = fs.readDirectories(path);
      // Discovery owns response validation; do not dereference malformed results here.
      if (Array.isArray(names)) {
        returnedDirectoryCount += names.length;
        checkLimit('maxEntries', returnedDirectoryCount, limits);
      }
      return names;
    },
  };
};
