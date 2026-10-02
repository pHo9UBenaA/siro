import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { asAbsPath } from '../../src/index.ts';
import { createNodeFileSystem } from '../../src/adapters/node-file-system.ts';
import { resolveScanLimits } from '../../src/core/contracts/scan-limits.ts';

// Simulate a file growing between stat and read, while retaining real fd IO.
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return {
    ...fs,
    statSync: vi.fn<(file: string) => import('node:fs').Stats>((file) => {
      const stat = fs.statSync(file);
      stat.size = 0;
      return stat;
    }),
  };
});

it.each(['maxFileBytes', 'maxTotalBytes'] as const)(
  'enforces %s during native reads, not just from stale metadata',
  (key) => {
    const root = mkdtempSync(path.join(tmpdir(), 'siro-growing-input-'));
    const file = asAbsPath(path.join(root, 'input'));
    try {
      writeFileSync(file, 'x'.repeat(4096));
      expect(statSync(file).size).toBe(0);
      const fs = createNodeFileSystem(resolveScanLimits({ [key]: 3 }));
      expect(() => fs.readText(file)).toThrow(new RegExp(key));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
