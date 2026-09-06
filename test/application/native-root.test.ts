import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lint } from '../../src/application/lint.ts';
import { asAbsPath } from '../../src/shared/paths.ts';

it('rejects a missing native repository even with an explicit manager', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'siro-root-'));
  try {
    expect(() => lint({ cwd: asAbsPath(path.join(directory, 'missing')), pm: 'npm' })).toThrow(
      Error,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('rejects a native file target as a usage error', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'siro-root-'));
  try {
    const file = path.join(directory, 'file');
    writeFileSync(file, '');
    expect(() => lint({ cwd: asAbsPath(file), pm: 'npm' })).toThrow('directory');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
