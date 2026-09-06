import { run } from '../../src/cli.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import { captureIO } from '../helpers/io.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { lintCommand } from '../../src/application/commands/lint.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('project type selection', () => {
  it('evaluates publish-only rules when a private package is explicitly a package project', () => {
    expect.hasAssertions();
    const fs = createMemFileSystem({
      'package-lock.json': '{}',
      'package.json': JSON.stringify({
        name: 'temporarily-private-package',
        packageManager: 'npm@10.9.0',
        private: true,
      }),
    });
    const { io, out } = captureIO();

    return lintCommand(
      { cwd: asAbsPath('/repo'), fs, projectType: 'package', reporter: 'json' },
      io,
    ).then(() => {
      const result: { findings: { ruleId: string }[] } = JSON.parse(out());
      const ids = result.findings.map((finding) => finding.ruleId);
      expect(ids).toStrictEqual(
        expect.arrayContaining(['files-field', 'provenance', 'publish-access']),
      );
    });
  });

  it('uses projectType from siro.config when the caller does not select one', () => {
    expect.hasAssertions();
    const dir = mkdtempSync(path.join(tmpdir(), 'siro-project-type-'));
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'configured-package', packageManager: 'npm@10.9.0', private: true }),
    );
    writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      "export default { projectType: 'package' };\n",
    );
    const { io, out } = captureIO();

    return run(['lint', dir, '--reporter', 'json'], io)
      .then(() => {
        const result: { findings: { ruleId: string }[] } = JSON.parse(out());
        const ids = result.findings.map((finding) => finding.ruleId);
        expect(ids).toStrictEqual(
          expect.arrayContaining(['files-field', 'provenance', 'publish-access']),
        );
      })
      .finally(() => {
        rmSync(dir, { force: true, recursive: true });
      });
  });

  it('lets an explicit application projectType override package config', () => {
    expect.hasAssertions();
    const dir = mkdtempSync(path.join(tmpdir(), 'siro-project-type-precedence-'));
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'configured-package', packageManager: 'npm@10.9.0' }),
    );
    writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      "export default { projectType: 'package' };\n",
    );
    const { io, out } = captureIO();

    return run(['lint', dir, '--project-type', 'application', '--reporter', 'json'], io)
      .then(() => {
        const result: { findings: { ruleId: string }[] } = JSON.parse(out());
        const packageRules = new Set(['files-field', 'provenance', 'publish-access']);
        expect(result.findings.filter((finding) => packageRules.has(finding.ruleId))).toStrictEqual(
          [],
        );
      })
      .finally(() => {
        rmSync(dir, { force: true, recursive: true });
      });
  });
});
