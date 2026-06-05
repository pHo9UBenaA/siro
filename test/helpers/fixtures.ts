import type { FileSystem } from '../../src/domain/ports/file-system.ts';
import { createMemFileSystem } from './memfs.ts';

export const npmGoodFs = (): FileSystem =>
  createMemFileSystem({
    '.npmrc': [
      'ignore-scripts=true',
      'save-exact=true',
      "save-prefix=''",
      'provenance=true',
      'min-release-age=7',
      '',
    ].join('\n'),
    'package-lock.json': JSON.stringify({
      lockfileVersion: 3,
      name: 'demo',
      packages: {},
      requires: true,
      version: '1.0.0',
    }),
    'package.json': JSON.stringify({
      files: ['dist'],
      name: 'demo',
      packageManager: 'npm@10.9.0',
      publishConfig: { access: 'public' },
      version: '1.0.0',
    }),
  });
