import { asAbsPath, lint, lintCommand, type LintCommandOptions } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { captureIO } from '../helpers/io.ts';

it('TLS warnings and failure thresholds are distinct from finding correctness', async () => {
  const fs = createMemFileSystem({
    'package.json': '{"private":true}',
    'package-lock.json': '{}',
    '.npmrc':
      'strict-ssl=false\nignore-scripts=true\nsave-exact=true\nmin-release-age=3\nallow-git=none\nallow-remote=none',
  });
  const result = lint({ cwd: asAbsPath('/repo'), pm: 'npm', fs });
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'enforce-strict-ssl', severity: 'warn', actual: false }),
  );
  const request = {
    cwd: asAbsPath('/repo'),
    pm: 'npm',
    fs,
    reporter: 'json',
  } satisfies LintCommandOptions;
  expect(await lintCommand(request, captureIO().io)).toBe(0);
  expect(await lintCommand({ ...request, severity: 'warn' }, captureIO().io)).toBe(1);
});

it('keeps the lint exit decision independent of reporter mutations', async () => {
  const exitCode = await lintCommand(
    {
      cwd: asAbsPath('/virtual'),
      pm: 'npm',
      fs: { readDirectories: () => [], exists: () => false, readText: () => undefined },
      reporter: {
        name: 'mutating',
        format(result) {
          for (const finding of result.findings) Reflect.set(finding, 'severity', 'info');
        },
      },
    },
    captureIO().io,
  );
  expect(exitCode).toBe(1);
});
