import { lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nodeFileSystem } from '../../src/adapters/node-file-system.ts';
import { asAbsPath } from '../../src/shared/paths.ts';

it('follows actual volume name lookup while excluding directory aliases through symlinks', () => {
  const root = asAbsPath(mkdtempSync(path.join(tmpdir(), 'siro-native-prefix-')));
  try {
    mkdirSync(path.join(root, 'Packages'));
    writeFileSync(path.join(root, 'file'), '');
    symlinkSync(path.join(root, 'Packages'), path.join(root, 'alias'), 'junction');
    expect(nodeFileSystem.resolveDirectory?.(root, 'Packages')).toBe('Packages');
    expect(nodeFileSystem.resolveDirectory?.(root, 'missing')).toBeUndefined();
    expect(nodeFileSystem.resolveDirectory?.(root, 'file')).toBeUndefined();
    expect(nodeFileSystem.resolveDirectory?.(root, 'alias')).toBeUndefined();
    let nativeAlias = false;
    try {
      nativeAlias = lstatSync(path.join(root, 'PACKAGES')).isDirectory();
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    expect(nodeFileSystem.resolveDirectory?.(root, 'PACKAGES')).toBe(
      nativeAlias ? 'Packages' : undefined,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
