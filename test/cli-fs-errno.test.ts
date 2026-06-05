import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { run } from '../src/cli.ts';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

const EXIT_USAGE = 2;

// ENOTDIR (path under a regular file) is POSIX-deterministic; Windows
// reports ENOENT for the same shape, which readText treats as absent.
describe.skipIf(process.platform === 'win32')('run maps filesystem errno errors to exit 2', () => {
  let dir = '';
  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  test('exits 2 with a named error when the target path is a regular file (ENOTDIR)', () => {
    expect.hasAssertions();
    dir = mkdtempSync(path.join(tmpdir(), 'siro-errno-'));
    const filePath = path.join(dir, 'not-a-dir');
    writeFileSync(filePath, '');
    const errLines: string[] = [];
    const io = {
      stderr: (line: string): void => {
        errLines.push(line);
      },
      stdout: (): void => {
        // no-op
      },
    };
    return run(['lint', filePath], io).then((code) => {
      expect(code).toBe(EXIT_USAGE);
      expect(errLines.join('\n')).toContain('File system error');
    });
  });
});
