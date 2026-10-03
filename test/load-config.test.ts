import { writeFileSync } from 'node:fs';
import { createTestProject } from './helpers/temp-project.ts';
import { loadConfig } from '../src/load-config.ts';
import { asAbsPath } from '../src/adapters/node-paths.ts';
import path from 'node:path';

describe('loadConfig — no config', () => {
  it('returns undefined when no config file exists', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    const config = await loadConfig(configDirectory);

    expect(config).toBeUndefined();
  });
});

describe('loadConfig — loading', () => {
  it('loads siro.config.mjs and exposes the user config', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.mjs'),
      `export default {
        pms: ['npm'],
        rules: { provenance: 'off', custom: 'info' },
        customRules: [{
          id: 'custom', title: 'Custom', description: 'Custom', severity: 'warn', bindings: {},
        }],
        reporters: [{ name: 'noop', format() {} }],
      };`,
    );
    const config = await loadConfig(configDirectory);

    expect(config).toMatchObject({
      pms: ['npm'],
      rules: { provenance: 'off', custom: 'info' },
      customRules: [{ id: 'custom' }],
      reporters: [{ name: 'noop', format: expect.any(Function) }],
    });
  });

  it('defers unknown-rule-id checks so the loader does not pre-judge programmatic customRules', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.mjs'),
      "export default { rules: { 'no-such-rule': 'warn' } };\n",
    );
    const config = await loadConfig(configDirectory);

    expect(config).toStrictEqual({ rules: { 'no-such-rule': 'warn' } });
  });

  it('retains prototype-named own settings in a null-prototype dictionary', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.mjs'),
      `export default {
        rules: Object.create(null, {
          ['__proto__']: { value: 'warn', enumerable: true },
          constructor: { value: 'off', enumerable: true },
          ordinary: { value: 'off', enumerable: true },
        }),
      };\n`,
    );
    const config = await loadConfig(configDirectory);

    expect(config?.rules).toStrictEqual({
      ['__proto__']: 'warn',
      constructor: 'off',
      ordinary: 'off',
    });
  });
});

describe('loadConfig — export shape validation', () => {
  it('wraps a module-evaluation error as ConfigError naming the offending file', () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.mjs'),
      "throw new Error('boom from user config');\n",
    );
    return expect(loadConfig(configDirectory)).rejects.toMatchObject({
      message: expect.stringMatching(/Failed to load siro\.config\.mjs:.*boom from user config/u),
      name: 'ConfigError',
    });
  });
});

describe('loadConfig — schema validation', () => {
  it('rejects an unknown top-level config key (typo guard)', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.mjs'),
      "export default { rule: { provenance: 'off' } };\n",
    );
    await expect(loadConfig(configDirectory)).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringMatching(/rule/u),
    });
  });

  it.each(['provenance', 'constructor', '__proto__'])(
    'rejects an invalid own severity for %s with its config path',
    (id) => {
      const configDirectory = asAbsPath(createTestProject({}));
      writeFileSync(
        path.join(configDirectory, 'siro.config.mjs'),
        `export default { rules: { [${JSON.stringify(id)}]: 'fatal' } };\n`,
      );
      return expect(loadConfig(configDirectory)).rejects.toMatchObject({
        message: expect.stringContaining(`rules.${id}`),
        name: 'ConfigError',
      });
    },
  );
});

describe('loadConfig — reporters', () => {
  it('rejects a config reporter that is missing its format function', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.mjs'),
      "export default { reporters: [{ name: 'broken' }] };\n",
    );
    await expect(loadConfig(configDirectory)).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringMatching(/reporter/iu),
    });
  });
});

const nonRecordContainers = [
  ['null', 'null'],
  ['number', '42'],
  ['array', '[]'],
  ['custom prototype', 'Object.create({})'],
] as const;

describe.each(['root', 'rules'] as const)('loadConfig — %s container contract', (location) => {
  it.each(nonRecordContainers)(
    'rejects a %s instead of silently loading empty settings',
    async (_name, expression) => {
      const configDirectory = asAbsPath(createTestProject({}));
      const candidate = location === 'root' ? expression : `{ rules: ${expression} }`;
      writeFileSync(
        path.join(configDirectory, 'siro.config.mjs'),
        `export default ${candidate};\n`,
      );
      await expect(loadConfig(configDirectory)).rejects.toMatchObject({
        name: 'ConfigError',
        message: expect.stringMatching(location === 'root' ? /siro\.config\.mjs/u : /rules/u),
      });
    },
  );
});

describe('loadConfig — fresh reload', () => {
  it('reads a same-process config rewrite on the next call', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    const file = path.join(configDirectory, 'siro.config.mjs');
    writeFileSync(file, "export default { pms: ['npm'] };\n");
    expect(await loadConfig(configDirectory)).toStrictEqual({ pms: ['npm'] });
    writeFileSync(file, "export default { pms: ['pnpm'] };\n");
    expect(await loadConfig(configDirectory)).toStrictEqual({ pms: ['pnpm'] });
  });
});

describe('loadConfig — ts config', () => {
  it('loads siro.config.ts with erasable TS syntax', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.ts'),
      `const rule: string = 'provenance';
      export default {
        pms: ['npm'] as const,
        rules: { [rule]: 'off' },
      };`,
    );
    const config = await loadConfig(configDirectory);

    expect(config).toStrictEqual({ pms: ['npm'], rules: { provenance: 'off' } });
  });
});

describe('loadConfig — ts config on a runtime without type stripping', () => {
  it('rejects siro.config.ts with an actionable ConfigError', () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.ts'),
      "export default { pms: ['npm'] };\n",
    );
    return expect(loadConfig(configDirectory, '20.19.0')).rejects.toMatchObject({
      message: expect.stringMatching(/type stripping[\s\S]*siro\.config\.mjs/u),
      name: 'ConfigError',
    });
  });
});

describe('loadConfig root dictionary', () => {
  it('accepts a null-prototype root', async () => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.mjs'),
      "export default Object.assign(Object.create(null), { pms: ['npm'] });",
    );
    expect(await loadConfig(configDirectory)).toEqual({ pms: ['npm'] });
  });
});

describe('loadConfig package managers', () => {
  it.each([{ pms: ['rubygems'] }, { pms: [] }])('rejects invalid pms $pms', async ({ pms }) => {
    const configDirectory = asAbsPath(createTestProject({}));
    writeFileSync(
      path.join(configDirectory, 'siro.config.mjs'),
      'export default ' + JSON.stringify({ pms }) + ';',
    );
    await expect(loadConfig(configDirectory)).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringMatching(/siro\.config\.mjs:.*pms/u),
    });
  });
});
