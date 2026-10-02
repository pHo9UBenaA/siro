import { run } from '../../src/cli.ts';
import { asAbsPath } from '../../src/adapters/node-paths.ts';
import { captureIO } from '../helpers/io.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { lintCommand } from '../../src/runtime.ts';
import { rmSync } from 'node:fs';
import { createTempProject } from '../helpers/temp-project.ts';

describe('project type selection', () => {
  it('evaluates publish-only rules when a private package is explicitly a package project', async () => {
    const fs = createMemFileSystem({
      'package-lock.json': '{}',
      'package.json': JSON.stringify({
        name: 'temporarily-private-package',
        packageManager: 'npm@10.9.0',
        private: true,
      }),
    });
    const { io, out } = captureIO();

    await lintCommand(
      { cwd: asAbsPath('/repo'), fs, projectType: 'package', reporter: 'json' },
      io,
    );

    const result: { findings: { ruleId: string }[] } = JSON.parse(out());
    const ids = result.findings.map((finding) => finding.ruleId);
    expect(ids).toStrictEqual(
      expect.arrayContaining(['files-field', 'provenance', 'publish-access']),
    );
  });

  it('uses projectType from siro.config when the caller does not select one', async () => {
    const dir = createTempProject({
      'package.json': JSON.stringify({
        name: 'configured-package',
        packageManager: 'npm@10.9.0',
        private: true,
      }),
      'package-lock.json': '{}',
      'siro.config.mjs': "export default { projectType: 'package' };\n",
    });
    const { io, out } = captureIO();

    try {
      await run(['lint', dir, '--reporter', 'json'], io);

      const result: { findings: { ruleId: string }[] } = JSON.parse(out());
      const ids = result.findings.map((finding) => finding.ruleId);
      expect(ids).toStrictEqual(
        expect.arrayContaining(['files-field', 'provenance', 'publish-access']),
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('lets an explicit application projectType override package config', async () => {
    const dir = createTempProject({
      'package.json': JSON.stringify({ name: 'configured-package', packageManager: 'npm@10.9.0' }),
      'package-lock.json': '{}',
      'siro.config.mjs': "export default { projectType: 'package' };\n",
    });
    const { io, out } = captureIO();

    try {
      await run(['lint', dir, '--project-type', 'application', '--reporter', 'json'], io);

      const result: { findings: { ruleId: string }[] } = JSON.parse(out());
      const packageRules = new Set(['files-field', 'provenance', 'publish-access']);
      expect(result.findings.filter((finding) => packageRules.has(finding.ruleId))).toStrictEqual(
        [],
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
