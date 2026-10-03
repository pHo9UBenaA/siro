import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { asAbsPath, lint } from '../../src/index.ts';
import { createNodeFileSystem } from '../../src/adapters/node-file-system.ts';
import { isNodeError } from '../../src/adapters/node-errors.ts';
import { resolveScanLimits } from '../../src/core/contracts/scan-limits.ts';

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'siro-native-budget-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it('enforces cumulative native bytes and exact file byte boundaries', () => {
  const file = asAbsPath(path.join(root, 'data'));
  writeFileSync(file, 'é');
  expect(createNodeFileSystem(resolveScanLimits({ maxFileBytes: 2 })).readText(file)).toBe('é');
  expect(() => createNodeFileSystem(resolveScanLimits({ maxFileBytes: 1 })).readText(file)).toThrow(
    /maxFileBytes/,
  );
  const fs = createNodeFileSystem(resolveScanLimits({ maxTotalBytes: 3 }));
  expect(fs.readText(file)).toBe('é');
  expect(() => fs.readText(file)).toThrow(/maxTotalBytes/);
});

it('counts ordinary files, not just child directories, before enumeration completes', () => {
  for (const file of ['one', 'two', 'three']) writeFileSync(path.join(root, file), '');
  expect(
    createNodeFileSystem(resolveScanLimits({ maxEntries: 3 })).readDirectories(asAbsPath(root)),
  ).toEqual([]);
  expect(() =>
    createNodeFileSystem(resolveScanLimits({ maxEntries: 2 })).readDirectories(asAbsPath(root)),
  ).toThrow(/maxEntries/);
});

it('rejects dangling/input/ancestor symlinks and symlink cwd under strict reads', (context) => {
  const repository = path.join(root, 'repository');
  const outside = path.join(root, 'outside');
  mkdirSync(repository);
  mkdirSync(outside);
  writeFileSync(path.join(outside, 'package.json'), '{"private":true}');
  try {
    symlinkSync(
      outside,
      path.join(repository, 'alias'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    symlinkSync(path.join(root, 'missing'), path.join(repository, 'package.json'));
  } catch (error) {
    if (process.platform === 'win32' && isNodeError(error) && error.code === 'EPERM') {
      context.skip();
      return;
    }
    throw error;
  }
  const fs = createNodeFileSystem(resolveScanLimits(), asAbsPath(repository));
  expect(() => fs.readText(asAbsPath(path.join(repository, 'alias/package.json')))).toThrow(
    /symlink/,
  );
  expect(() => fs.exists(asAbsPath(path.join(repository, 'package.json')))).toThrow(/symlink/);
  expect(() =>
    lint({
      cwd: asAbsPath(path.join(repository, 'alias')),
      rejectSymlinks: true,
      installationRoots: [],
    }),
  ).toThrow(/symlink cwd/);
  expect(() =>
    lint({
      cwd: asAbsPath(path.join(repository, 'alias') + path.sep),
      rejectSymlinks: true,
      installationRoots: [],
    }),
  ).toThrow(/symlink cwd/);
  expect(fs.readDirectories(asAbsPath(repository))).toEqual([]);
});
