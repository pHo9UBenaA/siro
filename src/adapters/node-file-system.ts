import { ConfigError, UsageError } from '../shared/errors.ts';
import { type AbsPath, type RelPath, asRelPath, asAbsPath } from '../shared/paths.ts';
import { readFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
import type { FileSystem } from '../domain/ports/file-system.ts';
import { isNodeError } from './node-errors.ts';
import path from 'node:path';

const assertRegularFile = (filePath: AbsPath): void => {
  if (!statSync(filePath).isFile()) throw new ConfigError(`${filePath}: expected a regular file.`);
};

// `existsSync` and bare catch-all `false`/`undefined` returns would mask
// EACCES, EISDIR, and friends as "not there" — fatal for a security linter,
// which would then silently skip a config it cannot read and report
// "no findings" on an unauthorized scan. Only ENOENT is translated to absent;
// every other errno propagates.
export const nodeFileSystem: FileSystem = {
  readDirectories(directory) {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  },
  resolveDirectory(parent, name) {
    let target;
    try {
      target = lstatSync(path.join(parent, name), { bigint: true });
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return undefined;
      throw error;
    }
    if (!target.isDirectory()) return undefined;
    const names = readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    if (names.includes(name)) return name;
    // Resolve native aliases without guessing case policy from the OS or using
    // realpath's platform-dependent spelling. Directory identities must be unique.
    const matches = names.filter((candidate) => {
      const entry = lstatSync(path.join(parent, candidate), { bigint: true });
      return entry.isDirectory() && entry.dev === target.dev && entry.ino === target.ino;
    });
    if (target.ino === 0n || matches.length !== 1) {
      throw new ConfigError(`${parent}: cannot identify the resolved workspace directory ${name}.`);
    }
    return matches[0];
  },
  exists(filePath) {
    try {
      assertRegularFile(filePath);
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
      assertRegularFile(filePath);
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
  asAbsPath(path.join(root, asRelPath(relPath)));

export const assertDirectory = (root: AbsPath): void => {
  if (!statSync(root).isDirectory()) throw new UsageError('The lint target must be a directory.');
};
