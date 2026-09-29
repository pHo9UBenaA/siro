import { Volume, createFsFromVolume } from 'memfs';
import nodePath from 'node:path';
import type { FileSystem } from '../../src/core/contracts/file-system.ts';
import { isNodeError } from '../../src/adapters/node-errors.ts';
import { ConfigError } from '../../src/core/contracts/errors.ts';

export const createMemFileSystem = (
  initial: Readonly<Record<string, string>>,
  root = '/repo',
): FileSystem => {
  const vol = Volume.fromJSON(initial, root);
  const fs = createFsFromVolume(vol);
  fs.mkdirSync(root, { recursive: true });
  const native = (value: string) => (nodePath.sep === '\\' ? value.replaceAll('\\', '/') : value);
  return {
    readDirectories(directory) {
      return fs
        .readdirSync(native(directory))
        .map(String)
        .filter((name) => fs.lstatSync(`${native(directory)}/${name}`).isDirectory());
    },
    exists(path) {
      // Match native file-type checks and propagate every non-ENOENT error.
      try {
        if (!fs.statSync(native(path)).isFile())
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
        const content = String(fs.readFileSync(native(path), 'utf8'));
        return content;
      } catch (error) {
        // Mirror the production FS contract: ENOENT is "file absent",
        // anything else (EACCES, EISDIR, …) must propagate so a misconfigured
        // memfs surfaces as a test failure instead of a silent miss.
        if (isNodeError(error) && error.code === 'ENOENT') {
          return;
        }
        throw error;
      }
    },
  };
};
