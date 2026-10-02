import type { FileSystem } from './contracts/file-system.ts';
import type { AbsPath } from './contracts/paths.ts';
import { checkLimit, type ScanLimits, utf8Bytes } from './contracts/scan-limits.ts';

/** Bounds returned data from trusted injected IO; cannot bound allocations inside that IO. */
export const boundedFileSystem = (fs: FileSystem, limits: ScanLimits): FileSystem => {
  const texts = new Map<AbsPath, string | undefined>();
  let bytes = 0;
  let entries = 0;
  return {
    exists: (path) => fs.exists(path),
    readText(path) {
      if (!texts.has(path)) {
        const text = fs.readText(path);
        if (text !== undefined) {
          const size = utf8Bytes(text);
          checkLimit('maxFileBytes', size, limits);
          bytes += size;
          checkLimit('maxTotalBytes', bytes, limits);
        }
        texts.set(path, text);
      }
      return texts.get(path);
    },
    readDirectories(path) {
      const names = fs.readDirectories(path);
      // Discovery owns response validation; do not dereference malformed results here.
      if (Array.isArray(names)) {
        entries += names.length;
        checkLimit('maxEntries', entries, limits);
      }
      return names;
    },
  };
};
