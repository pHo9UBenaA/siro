import { Volume, createFsFromVolume } from 'memfs';
import type { FileSystem } from '../../src/domain/ports/file-system.ts';
import { isNodeError } from '../../src/adapters/node-errors.ts';
import { ConfigError } from '../../src/shared/errors.ts';

export const createMemFileSystem = (
  initial: Readonly<Record<string, string>>,
  root = '/repo',
): FileSystem => {
  const vol = Volume.fromJSON(initial, root);
  const fs = createFsFromVolume(vol);
  return {
    exists(path) {
      // Match native file-type checks and propagate every non-ENOENT error.
      try {
        if (!fs.statSync(path.replaceAll('\\', '/')).isFile())
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
        const content = String(fs.readFileSync(path.replaceAll('\\', '/'), 'utf8'));
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
