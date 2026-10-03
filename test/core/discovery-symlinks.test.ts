import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { asAbsPath, lint } from '../../src/index.ts';

it('does not follow directory symlinks, including intermediate components of explicit roots', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'siro-links-'));
  try {
    mkdirSync(path.join(root, 'actual', 'nested'), { recursive: true });
    writeFileSync(path.join(root, 'actual', 'nested', 'package.json'), '{"name":"nested"}');
    symlinkSync(
      path.join(root, 'actual'),
      path.join(root, 'alias'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const options = { cwd: asAbsPath(root), installationRoots: [] };
    expect(lint(options).inspection.manifests.map((manifest) => manifest.path)).toEqual([
      'actual/nested/package.json',
    ]);
    for (const directory of ['alias', 'alias/nested', 'Actual', 'actual/nested/package.json']) {
      expect(() =>
        lint({ ...options, installationRoots: [{ path: directory, pm: 'npm' }] }),
      ).toThrow(/installation root/);
    }
    // The user may deliberately select the symlink itself as cwd.
    expect(
      lint({ ...options, cwd: asAbsPath(path.join(root, 'alias')) }).inspection.manifests.map(
        (manifest) => manifest.path,
      ),
    ).toEqual(['nested/package.json']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
