import { existsSync } from 'node:fs';

const entry = new URL('../dist/index.mjs', import.meta.url);

describe.skipIf(!existsSync(entry))('built public API', () => {
  it('evaluates a custom rule', async () => {
    const api: typeof import('../src/index.ts') = await import(entry.href);
    const result = api.lint({
      cwd: api.asAbsPath('/virtual'),
      pm: 'npm',
      fs: { exists: () => false, readText: () => undefined },
      config: {
        customRules: [
          api.defineRule({
            id: 'public-api-probe',
            title: 'Probe',
            description: 'Public API integration',
            severity: 'warn',
            bindings: {
              npm: {
                check: () => ({
                  state: 'violation',
                  message: 'Public API works',
                  remediation: { kind: 'manual', steps: ['Review the result'] },
                }),
              },
            },
          }),
        ],
      },
    });
    expect(result.findings.find((f) => f.ruleId === 'public-api-probe')).toMatchObject({
      severity: 'warn',
      message: 'Public API works',
      remediation: { kind: 'manual', steps: ['Review the result'] },
    });
  });
});
