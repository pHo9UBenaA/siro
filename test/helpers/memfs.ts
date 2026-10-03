import { Volume, createFsFromVolume } from 'memfs';
import nodePath from 'node:path';
import type { FileSystem } from '../../src/core/contracts/file-system.ts';
import { isNodeError } from '../../src/adapters/node-errors.ts';
import { ConfigError } from '../../src/core/contracts/errors.ts';

export const createMemFileSystem = (
  initial: Readonly<Record<string, string>>,
  root = '/repo',
): FileSystem => {
  const volume = Volume.fromJSON(initial, root);
  const fs = createFsFromVolume(volume);
  fs.mkdirSync(root, { recursive: true });
  const toMemfsPath = (value: string) =>
    nodePath.sep === '\\' ? value.replaceAll('\\', '/') : value;
  return {
    readDirectories(directory) {
      const directoryPath = toMemfsPath(directory);
      const names: string[] = [];
      for (const entry of fs.readdirSync(directoryPath)) {
        const name = String(entry);
        if (fs.lstatSync(`${directoryPath}/${name}`).isDirectory()) names.push(name);
      }
      return names;
    },
    exists(path) {
      // Match native file-type checks and propagate every non-ENOENT error.
      try {
        if (!fs.statSync(toMemfsPath(path)).isFile())
          throw new ConfigError(`${path}: expected a regular file.`);
        return true;
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
          return false;
        }
        throw error;
      }
    },
    readText(path) {
      try {
        return String(fs.readFileSync(toMemfsPath(path), 'utf8'));
      } catch (error) {
        // Only ENOENT means absence; unreadable files must fail like native reads.
        if (isNodeError(error) && error.code === 'ENOENT') {
          return;
        }
        throw error;
      }
    },
  };
};
