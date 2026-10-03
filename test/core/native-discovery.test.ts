import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { asAbsPath, lint } from '../../src/index.ts';

describe.skipIf(process.platform === 'win32')('native POSIX names', () => {
  it('preserves distinct legal native backslash, slash and colon directories', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'siro-native-'));
    try {
      writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ private: true, workspaces: ['**'] }),
      );
      mkdirSync(path.join(root, 'empty\\notes'));
      for (const name of ['scratch\\notes', 'scratch/notes', 'C:notes']) {
        mkdirSync(path.join(root, name), { recursive: true });
        writeFileSync(path.join(root, name, 'package.json'), '{"name":"child"}');
      }
      const result = lint({
        cwd: asAbsPath(root),
        pm: 'npm',
        installationRoots: [
          '.',
          { path: 'scratch\\notes', pm: 'npm' },
          { path: 'scratch/notes', pm: 'npm' },
          { path: 'C:notes', pm: 'npm' },
        ],
      });
      expect(
        result.findings
          .filter((finding) => finding.ruleId === 'files-field')
          .map((finding) => finding.file)
          .sort(),
      ).toEqual(
        [
          'C:notes/package.json',
          'scratch/notes/package.json',
          'scratch\\notes/package.json',
        ].sort(),
      );
      expect(
        result.findings
          .filter(
            (finding) => finding.directory !== '.' && finding.ruleId === 'block-exotic-subdeps',
          )
          .map((finding) => finding.remediation),
      ).toEqual(
        ['C:notes', 'scratch/notes', 'scratch\\notes'].map((directory) => ({
          kind: 'automatic',
          operations: [
            {
              file: { kind: 'npmrc', path: `${directory}/.npmrc` },
              op: 'setKey',
              keyPath: ['allow-git'],
              value: 'none',
            },
            {
              file: { kind: 'npmrc', path: `${directory}/.npmrc` },
              op: 'setKey',
              keyPath: ['allow-remote'],
              value: 'none',
            },
          ],
        })),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
