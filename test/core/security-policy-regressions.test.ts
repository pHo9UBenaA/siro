import { asAbsPath, lint, lintCommand, type PM } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { captureIO } from '../helpers/io.ts';

const inspect = (pm: PM, files: Record<string, string>) =>
  lint({
    cwd: asAbsPath('/repo'),
    pm,
    fs: createMemFileSystem({
      'package.json': '{"private":true}',
      ...files,
    }),
  });

// Expectations come from the tagged upstream sources linked in docs/policy-sources.md,
// not whether the repository happens to receive a clean overall result.
it('Deno honors a configured lockfile and explicit inactive age cannot be rescued by fallback', () => {
  const files = {
    'deno.json': '{"lock":"locks/custom.lock","minimumDependencyAge":{"age":0}}',
    'locks/custom.lock': '',
    '.npmrc': 'min-release-age=3',
  };
  const result = inspect('deno', files);
  expect(result.findings.some((f) => f.ruleId === 'commit-lockfile')).toBe(false);
  expect(result.findings.some((f) => f.ruleId === 'minimum-release-age')).toBe(true);
  const fallback = inspect('deno', {
    ...files,
    'deno.json': '{"lock":"locks/custom.lock","minimumDependencyAge":{}}',
  });
  expect(fallback.findings.some((f) => f.ruleId === 'minimum-release-age')).toBe(false);
});

it('TLS warnings and failure thresholds are distinct from finding correctness', async () => {
  const fs = createMemFileSystem({
    'package.json': '{"private":true}',
    '.npmrc': 'strict-ssl=false',
  });
  const result = lint({ cwd: asAbsPath('/repo'), pm: 'npm', fs });
  expect(result.findings.find((f) => f.ruleId === 'enforce-strict-ssl')).toMatchObject({
    severity: 'warn',
    actual: false,
  });
  const settings = Object.fromEntries(
    result.findings
      .filter((f) => f.ruleId !== 'enforce-strict-ssl')
      .map((f) => [f.ruleId, 'off' as const]),
  );
  const request = {
    cwd: asAbsPath('/repo'),
    pm: 'npm' as const,
    fs,
    config: { rules: settings },
    reporter: 'json',
  };
  expect(await lintCommand(request, captureIO().io)).toBe(0);
  expect(await lintCommand({ ...request, severity: 'warn' }, captureIO().io)).toBe(1);
});

it('unknown child availability and inspection scope remain explicit', () => {
  const fs = createMemFileSystem({
    'package.json': '{"private":true,"packageManager":"npm@12.0.2"}',
    'child/package.json': '{"name":"child","packageManager":"pnpm@latest"}',
    'child/pnpm-workspace.yaml': 'strictDepBuilds: false',
  });
  const result = lint({ cwd: asAbsPath('/repo'), fs });
  expect(result.inspection.installationRoots.map((root) => root.directory)).toEqual(['.']);
  expect(result.inspection.manifests.find((m) => m.path === 'child/package.json')?.targets).toEqual(
    [{ pm: 'pnpm' }],
  );
  expect(
    result.findings.some(
      (f) => f.directory === 'child' && f.ruleId === 'disable-lifecycle-scripts',
    ),
  ).toBe(false);
  const expanded = lint({ cwd: asAbsPath('/repo'), fs, installationRoots: ['.', 'child'] });
  expect(
    expanded.findings.some(
      (f) => f.directory === 'child' && f.ruleId === 'disable-lifecycle-scripts',
    ),
  ).toBe(true);
});
