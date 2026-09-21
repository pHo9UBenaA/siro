import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { loadConfig } from '../../src/adapters/config-loader.ts';
import { asAbsPath } from '../../src/adapters/node-paths.ts';
import { ConfigError } from '../../src/shared/errors.ts';
import { type AbsPath } from '../../src/shared/paths.ts';

import { tmpdir } from 'node:os';
import path from 'node:path';

const useTempDir = (): { readonly dir: AbsPath } => {
  let dir = asAbsPath('/placeholder');
  beforeEach(() => {
    dir = asAbsPath(mkdtempSync(path.join(tmpdir(), 'siro-config-')));
  });
  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });
  return {
    get dir(): AbsPath {
      return dir;
    },
  };
};

describe('loadConfig — no config', () => {
  const td = useTempDir();

  it('returns undefined when no config file exists', () => {
    expect.hasAssertions();
    return loadConfig(td.dir).then((config) => {
      expect(config).toBeUndefined();
    });
  });
});

describe('loadConfig — loading', () => {
  const td = useTempDir();

  it('loads siro.config.mjs and exposes the user config', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      "export default { pms: ['npm'], rules: { provenance: 'off', custom: 'info' }, customRules: [{id:'custom',title:'Custom',description:'Custom',severity:'warn',bindings:{}}], reporters:[{name:'noop',format:()=>{}}] };\n",
    );
    return loadConfig(td.dir).then((config) => {
      expect(config).toMatchObject({
        pms: ['npm'],
        rules: { provenance: 'off', custom: 'info' },
        customRules: [{ id: 'custom' }],
        reporters: [{ name: 'noop', format: expect.any(Function) }],
      });
    });
  });

  it('defers unknown-rule-id checks so the loader does not pre-judge programmatic customRules', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      "export default { rules: { 'no-such-rule': 'warn' } };\n",
    );
    return loadConfig(td.dir).then((config) => {
      expect(config).toStrictEqual({ rules: { 'no-such-rule': 'warn' } });
    });
  });

  it('retains prototype-named own settings in a null-prototype dictionary', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      `export default {
        rules: Object.create(null, {
          ['__proto__']: { value: 'warn', enumerable: true },
          constructor: { value: 'off', enumerable: true },
          ordinary: { value: 'off', enumerable: true },
        }),
      };\n`,
    );
    return loadConfig(td.dir).then((config) => {
      expect(config?.rules).toStrictEqual({
        ['__proto__']: 'warn',
        constructor: 'off',
        ordinary: 'off',
      });
    });
  });
});

describe('loadConfig — export shape validation', () => {
  const td = useTempDir();

  it('wraps a module-evaluation error as ConfigError naming the offending file', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      "throw new Error('boom from user config');\n",
    );
    return expect(loadConfig(td.dir)).rejects.toMatchObject({
      message: expect.stringMatching(/Failed to load siro\.config\.mjs:.*boom from user config/u),
      name: 'ConfigError',
    });
  });
});

describe('loadConfig — schema validation', () => {
  const td = useTempDir();

  it('rejects an unknown top-level config key (typo guard)', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      "export default { rule: { provenance: 'off' } };\n",
    );
    return loadConfig(td.dir)
      .catch((error) => error)
      .then((err) => {
        expect(err).toBeInstanceOf(ConfigError);
        assert(err instanceof Error, 'expected Error');
        expect(err.message).toMatch(/rule/u);
      });
  });

  it.each(['provenance', 'constructor', '__proto__'])(
    'rejects an invalid own severity for %s with its config path',
    (id) => {
      expect.hasAssertions();
      writeFileSync(
        path.join(td.dir, 'siro.config.mjs'),
        `export default { rules: { [${JSON.stringify(id)}]: 'fatal' } };\n`,
      );
      return expect(loadConfig(td.dir)).rejects.toMatchObject({
        message: expect.stringContaining(`rules.${id}`),
        name: 'ConfigError',
      });
    },
  );
});

describe('loadConfig — reporters', () => {
  const td = useTempDir();

  it('rejects a config reporter that is missing its format function', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      "export default { reporters: [{ name: 'broken' }] };\n",
    );
    return loadConfig(td.dir)
      .catch((error) => error)
      .then((err) => {
        expect(err).toBeInstanceOf(ConfigError);
        assert(err instanceof Error, 'expected Error');
        expect(err.message).toMatch(/reporter/iu);
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
  const td = useTempDir();

  it.each(nonRecordContainers)(
    'rejects a %s instead of silently loading empty settings',
    async (_name, expression) => {
      const candidate = location === 'root' ? expression : `{ rules: ${expression} }`;
      writeFileSync(path.join(td.dir, 'siro.config.mjs'), `export default ${candidate};\n`);
      await expect(loadConfig(td.dir)).rejects.toMatchObject({
        name: 'ConfigError',
        message: expect.stringMatching(location === 'root' ? /siro\.config\.mjs/u : /rules/u),
      });
    },
  );
});

describe('loadConfig — fresh reload', () => {
  const td = useTempDir();

  it('reads a same-process config rewrite on the next call', async () => {
    const file = path.join(td.dir, 'siro.config.mjs');
    writeFileSync(file, "export default { pms: ['npm'] };\n");
    expect(await loadConfig(td.dir)).toStrictEqual({ pms: ['npm'] });
    writeFileSync(file, "export default { pms: ['pnpm'] };\n");
    expect(await loadConfig(td.dir)).toStrictEqual({ pms: ['pnpm'] });
  });
});

describe('loadConfig — ts config', () => {
  const td = useTempDir();

  it('loads siro.config.ts with erasable TS syntax', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.ts'),
      "const rule: string = 'provenance';\nexport default { pms: ['npm'] as const, rules: { [rule]: 'off' } };\n",
    );
    return loadConfig(td.dir).then((config) => {
      expect(config).toStrictEqual({ pms: ['npm'], rules: { provenance: 'off' } });
    });
  });
});

describe('loadConfig — ts config on a runtime without type stripping', () => {
  const td = useTempDir();

  it('rejects siro.config.ts with an actionable ConfigError', () => {
    expect.hasAssertions();
    writeFileSync(path.join(td.dir, 'siro.config.ts'), "export default { pms: ['npm'] };\n");
    return expect(loadConfig(td.dir, '20.19.0')).rejects.toMatchObject({
      message: expect.stringMatching(/type stripping[\s\S]*siro\.config\.mjs/u),
      name: 'ConfigError',
    });
  });
});

describe('loadConfig root dictionary', () => {
  const td = useTempDir();
  it('accepts a null-prototype root', async () => {
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      "export default Object.assign(Object.create(null),{pms:['npm']});",
    );
    expect(await loadConfig(td.dir)).toEqual({ pms: ['npm'] });
  });
});

describe('loadConfig package managers', () => {
  const td = useTempDir();
  it.each([{ pms: ['rubygems'] }, { pms: [] }])('rejects invalid pms $pms', async ({ pms }) => {
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      'export default ' + JSON.stringify({ pms }) + ';',
    );
    await expect(loadConfig(td.dir)).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringMatching(/siro\.config\.mjs:.*pms/u),
    });
  });
});
