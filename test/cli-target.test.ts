import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run } from '../src/cli.ts';
import { captureIO } from './helpers/io.ts';

it('rejects a missing target even when the package manager is explicit', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'siro-target-'));
  try {
    const { io, out, err } = captureIO();
    expect(await run(['lint', path.join(root, 'missing'), '--pm', 'npm', '--json'], io)).toBe(2);
    expect(out()).toBe('');
    expect(err()).toMatch(/ENOENT|not exist/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('rejects a file as a repository target', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'siro-target-'));
  try {
    const file = path.join(root, 'file');
    writeFileSync(file, 'not a repository');
    const { io } = captureIO();
    expect(await run(['lint', file, '--pm', 'npm'], io)).toBe(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
