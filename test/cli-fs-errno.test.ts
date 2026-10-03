import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { run } from '../src/cli.ts';
import { tmpdir } from 'node:os';
import { captureIO } from './helpers/io.ts';

const EXIT_USAGE = 2;

// ENOTDIR (path under a regular file) is POSIX-deterministic; Windows
// reports ENOENT for the same shape, which readText treats as absent.
describe.skipIf(process.platform === 'win32')('run maps filesystem errno errors to exit 2', () => {
  test('exits 2 with a named error when the target has a non-directory parent (ENOTDIR)', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'siro-errno-'));
    try {
      const filePath = path.join(directory, 'not-a-dir');
      writeFileSync(filePath, '');
      const { io, err } = captureIO();
      const code = await run(['lint', path.join(filePath, 'child')], io);
      expect(code).toBe(EXIT_USAGE);
      expect(err()).toContain('File system error');
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
