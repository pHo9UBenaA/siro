import { existsSync, writeFileSync } from 'node:fs';
import { createTestProject } from './helpers/temp-project.ts';
import { loadConfig } from '../src/load-config.ts';
import { asAbsPath } from '../src/adapters/node-paths.ts';
import path from 'node:path';

describe('JSON configuration', () => {
  it('automatically loads data settings without executing a coexisting JS config', async () => {
    const settings = {
      pms: ['npm', 'pnpm'],
      pmVersions: { npm: '12.0.2' },
      exclude: ['fixtures/**'],
      installationRoots: ['.', { path: 'tools', pm: 'npm', pmVersion: '12.0.2' }],
      projectType: 'application',
      rules: { provenance: 'off' },
    };
    const cwd = asAbsPath(
      createTestProject({
        'siro.config.json': JSON.stringify(settings),
        'siro.config.mjs': "throw new Error('must not execute');",
      }),
    );
    expect(await loadConfig(cwd)).toStrictEqual(settings);
  });

  it('loads an explicit JSON file instead of the automatic configuration', async () => {
    const cwd = asAbsPath(
      createTestProject({
        'siro.config.json': '{"pms":["npm"]}',
        'policy.json': '{"pms":["pnpm"]}',
      }),
    );
    expect(await loadConfig(cwd, { configPath: 'policy.json' })).toEqual({ pms: ['pnpm'] });
  });

  it('reads JSON rewrites without module caching', async () => {
    const cwd = asAbsPath(createTestProject({ 'siro.config.json': '{"pms":["npm"]}' }));
    expect(await loadConfig(cwd)).toEqual({ pms: ['npm'] });
    writeFileSync(path.join(cwd, 'siro.config.json'), '{"pms":["pnpm"]}');
    expect(await loadConfig(cwd)).toEqual({ pms: ['pnpm'] });
  });

  it.each([
    'null',
    '[]',
    '{"pms":[]}',
    '{"rules":{"provenance":"fatal"}}',
    '{"rules":{"company-rule":"off"}}',
    '{"rules":{"constructor":"warn"}}',
    '{"customRules":[]}',
    '{"reporters":[]}',
    '{"jsPlugins":["./plugin.mjs"]}',
    '{"extends":["./policy.mjs"]}',
    '{"rule":{}}',
  ])('rejects invalid or executable JSON settings: %s', async (text) => {
    const cwd = asAbsPath(createTestProject({ 'siro.config.json': text }));
    await expect(loadConfig(cwd)).rejects.toMatchObject({ name: 'ConfigError' });
  });

  it('reports malformed JSON without disclosing its contents or falling back to JS', async () => {
    const cwd = asAbsPath(
      createTestProject({
        'siro.config.json': 'FAKE_SECRET_NOT_JSON',
        'siro.config.mjs': "throw new Error('must not execute');",
      }),
    );
    await expect(loadConfig(cwd)).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringContaining('siro.config.json: invalid JSON'),
    });
  });

  it('bounds decoded UTF-8 text as well as raw file bytes', async () => {
    const cwd = asAbsPath(createTestProject({}));
    const bytes = Buffer.concat([
      Buffer.from('{"exclude":["'),
      Buffer.from([0xff]),
      Buffer.from('"]}'),
    ]);
    writeFileSync(path.join(cwd, 'siro.config.json'), bytes);
    await expect(loadConfig(cwd, { limits: { maxFileBytes: bytes.length } })).rejects.toMatchObject(
      {
        name: 'ConfigError',
        message: expect.stringContaining('maxFileBytes'),
      },
    );
  });

  it.each([
    { text: '{}'.padEnd(32), limits: { maxFileBytes: 16 }, diagnostic: 'maxFileBytes' },
    { text: '{"rules":{}}', limits: { maxConfigDepth: 1 }, diagnostic: 'maxConfigDepth' },
  ])('bounds JSON configuration by $diagnostic', async ({ text, limits, diagnostic }) => {
    const cwd = asAbsPath(createTestProject({ 'siro.config.json': text }));
    await expect(loadConfig(cwd, { limits })).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringContaining(diagnostic),
    });
  });
});

it('returns undefined when no config file exists', async () => {
  const cwd = asAbsPath(createTestProject({}));
  expect(await loadConfig(cwd)).toBeUndefined();
});

it('requires an explicit path in the API before executing repository config', async () => {
  const cwd = asAbsPath(createTestProject({}));
  const marker = path.join(cwd, 'marker');
  writeFileSync(
    path.join(cwd, 'siro.config.mjs'),
    `import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'ran');
    export default {};`,
  );
  await expect(loadConfig(cwd)).rejects.toMatchObject({ name: 'ConfigError' });
  expect(existsSync(marker)).toBe(false);
});

it('loads an explicitly selected module, including custom rules and reporters', async () => {
  const cwd = asAbsPath(
    createTestProject({
      'policy.mjs': `export default {
      pms: ['npm'],
      rules: { provenance: 'off', custom: 'info' },
      customRules: [{
        id: 'custom', title: 'Custom', description: 'Custom', severity: 'warn', bindings: {},
      }],
      reporters: [{ name: 'noop', format() {} }],
    };`,
    }),
  );
  expect(await loadConfig(cwd, { configPath: 'policy.mjs' })).toMatchObject({
    pms: ['npm'],
    rules: { provenance: 'off', custom: 'info' },
    customRules: [{ id: 'custom' }],
    reporters: [{ name: 'noop', format: expect.any(Function) }],
  });
});

it('defers unknown-rule-id checks so programmatic customRules can register them later', async () => {
  const cwd = asAbsPath(
    createTestProject({
      'policy.mjs': "export default { rules: { 'no-such-rule': 'warn' } };",
    }),
  );
  expect(await loadConfig(cwd, { configPath: 'policy.mjs' })).toStrictEqual({
    rules: { 'no-such-rule': 'warn' },
  });
});

it('retains prototype-named own settings in a null-prototype dictionary', async () => {
  const cwd = asAbsPath(
    createTestProject({
      'policy.mjs': `export default {
      rules: Object.create(null, {
        ['__proto__']: { value: 'warn', enumerable: true },
        constructor: { value: 'off', enumerable: true },
        ordinary: { value: 'off', enumerable: true },
      }),
    };`,
    }),
  );
  expect((await loadConfig(cwd, { configPath: 'policy.mjs' }))?.rules).toStrictEqual({
    ['__proto__']: 'warn',
    constructor: 'off',
    ordinary: 'off',
  });
});

it('wraps module-evaluation errors as ConfigError naming the selected file', async () => {
  const cwd = asAbsPath(
    createTestProject({
      'policy.mjs': "throw new Error('boom from user config');",
    }),
  );
  await expect(loadConfig(cwd, { configPath: 'policy.mjs' })).rejects.toMatchObject({
    name: 'ConfigError',
    message: expect.stringMatching(/Failed to load policy\.mjs:.*boom from user config/u),
  });
});

it.each([
  { config: "{ rule: { provenance: 'off' } }", diagnostic: /rule/u },
  { config: "{ reporters: [{ name: 'broken' }] }", diagnostic: /reporters/u },
  { config: "{ pms: ['rubygems'] }", diagnostic: /pms/u },
  { config: '{ pms: [] }', diagnostic: /pms/u },
])('rejects malformed selected config: $config', async ({ config, diagnostic }) => {
  const cwd = asAbsPath(createTestProject({ 'policy.mjs': `export default ${config};` }));
  await expect(loadConfig(cwd, { configPath: 'policy.mjs' })).rejects.toMatchObject({
    name: 'ConfigError',
    message: expect.stringMatching(diagnostic),
  });
});

it.each(['provenance', 'constructor', '__proto__'])(
  'rejects an invalid own severity for %s with its config path',
  async (id) => {
    const cwd = asAbsPath(
      createTestProject({
        'policy.mjs': `export default { rules: { [${JSON.stringify(id)}]: 'fatal' } };`,
      }),
    );
    await expect(loadConfig(cwd, { configPath: 'policy.mjs' })).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringContaining(`rules.${id}`),
    });
  },
);

const nonRecordContainers = [
  ['null', 'null'],
  ['number', '42'],
  ['array', '[]'],
  ['custom prototype', 'Object.create({})'],
] as const;

describe.each(['root', 'rules'] as const)('loadConfig — %s container contract', (location) => {
  it.each(nonRecordContainers)('rejects a %s', async (_name, expression) => {
    const candidate = location === 'root' ? expression : `{ rules: ${expression} }`;
    const cwd = asAbsPath(createTestProject({ 'policy.mjs': `export default ${candidate};` }));
    await expect(loadConfig(cwd, { configPath: 'policy.mjs' })).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringMatching(location === 'root' ? /policy\.mjs/u : /rules/u),
    });
  });
});

it('reads a same-process config rewrite on the next call', async () => {
  const cwd = asAbsPath(createTestProject({ 'policy.mjs': "export default { pms: ['npm'] };" }));
  expect(await loadConfig(cwd, { configPath: 'policy.mjs' })).toStrictEqual({ pms: ['npm'] });
  writeFileSync(path.join(cwd, 'policy.mjs'), "export default { pms: ['pnpm'] };");
  expect(await loadConfig(cwd, { configPath: 'policy.mjs' })).toStrictEqual({ pms: ['pnpm'] });
});

it('loads a selected TypeScript config with erasable syntax', async () => {
  const cwd = asAbsPath(
    createTestProject({
      'policy.ts': `const rule: string = 'provenance';
    export default { pms: ['npm'] as const, rules: { [rule]: 'off' } };`,
    }),
  );
  expect(await loadConfig(cwd, { configPath: 'policy.ts' })).toStrictEqual({
    pms: ['npm'],
    rules: { provenance: 'off' },
  });
});

it('rejects selected TypeScript on a runtime without type stripping', async () => {
  const cwd = asAbsPath(createTestProject({ 'policy.ts': 'export default {};' }));
  await expect(
    loadConfig(cwd, { configPath: 'policy.ts', nodeVersion: '20.19.0' }),
  ).rejects.toMatchObject({
    name: 'ConfigError',
    message: expect.stringMatching(/type stripping[\s\S]*\.mjs/u),
  });
});

it('accepts a null-prototype root from an executable config', async () => {
  const cwd = asAbsPath(
    createTestProject({
      'policy.mjs': "export default Object.assign(Object.create(null), { pms: ['npm'] });",
    }),
  );
  expect(await loadConfig(cwd, { configPath: 'policy.mjs' })).toEqual({ pms: ['npm'] });
});

it.each(['missing.mjs', 'policy.txt'])(
  'rejects an absent or unsupported explicit config: %s',
  async (configPath) => {
    const cwd = asAbsPath(createTestProject({ 'policy.txt': 'export default {};' }));
    await expect(loadConfig(cwd, { configPath })).rejects.toMatchObject({ name: 'ConfigError' });
  },
);
