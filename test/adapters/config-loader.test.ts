import assert from 'node:assert';
import { ConfigError } from '../../src/shared/errors.ts';
import { loadConfig } from '../../src/adapters/config-loader.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { type AbsPath, asAbsPath } from '../../src/shared/paths.ts';

import path from 'node:path';
import { tmpdir } from 'node:os';

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
      "export default { pms: ['npm'], rules: { provenance: 'off' } };\n",
    );
    return loadConfig(td.dir).then((config) => {
      expect(config).toStrictEqual({ pms: ['npm'], rules: { provenance: 'off' } });
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

  it('rejects a config with a custom prototype instead of discarding its options', async () => {
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      "export default Object.create({ pms: ['npm'] });\n",
    );
    await expect(loadConfig(td.dir)).rejects.toThrow(/must export a config object/u);
  });

  it('accepts a customRules entry whose id does not collide with any builtin', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      `export default {
        customRules: [
          { id: 'team-policy-check', title: 't', description: 'd', severity: 'warn', bindings: {} },
        ],
      };\n`,
    );
    return loadConfig(td.dir).then((config) => {
      assert(config, 'expected config');
      expect(config.customRules).toHaveLength(1);
    });
  });
});

describe('loadConfig — export shape validation', () => {
  const td = useTempDir();

  it('rejects a config that does not export an object', () => {
    expect.hasAssertions();
    writeFileSync(path.join(td.dir, 'siro.config.mjs'), 'export default 42;\n');
    return expect(loadConfig(td.dir)).rejects.toThrow(/siro.config.mjs must export/u);
  });

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

  it('rejects a config whose pms array contains an unknown package manager', () => {
    expect.hasAssertions();
    writeFileSync(path.join(td.dir, 'siro.config.mjs'), "export default { pms: ['rubygems'] };\n");
    return loadConfig(td.dir)
      .catch((error) => error)
      .then((err) => {
        expect(err).toBeInstanceOf(ConfigError);
        assert(err instanceof Error, 'expected Error');
        expect(err.message).toMatch(/siro\.config\.mjs:.*pms/u);
      });
  });

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

  it.each(['provenance', 'constructor', 'prototype', '__proto__'])(
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

describe('loadConfig — customRules — happy path', () => {
  const td = useTempDir();

  it('accepts a rules override whose id is supplied by customRules in the same config', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      `export default {
        customRules: [{ id: 'my-rule', title: 't', description: 'd', severity: 'warn', bindings: {} }],
        rules: { 'my-rule': 'info' },
      };\n`,
    );
    return loadConfig(td.dir).then((config) => {
      assert(config, 'expected config');
      expect(config.rules).toStrictEqual({ 'my-rule': 'info' });
    });
  });
});

describe('loadConfig — reporters', () => {
  const td = useTempDir();

  it('accepts well-formed customRules / reporters without validating customRule contents', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      `export default {
        customRules: [{ id: 'x', title: 't', description: 'd', severity: 'warn', bindings: {} }],
        reporters: [{ name: 'noop', format: () => {} }],
      };\n`,
    );
    return loadConfig(td.dir).then((config) => {
      assert(config, 'expected config');
      expect(config.customRules).toHaveLength(1);
      expect(config.reporters).toHaveLength(1);
    });
  });

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
  ['string', "'settings'"],
  ['array', '[]'],
  ['date', 'new Date(0)'],
  ['map', 'new Map()'],
  ['set', 'new Set()'],
  ['regexp', '/settings/'],
  ['iterator', '[][Symbol.iterator]()'],
  ['class instance', 'new (class Config {})()'],
  ['class named Object', 'new (class Object {})()'],
  ['custom prototype', 'Object.create({})'],
  ['cross-realm object', "(await import('node:vm')).runInNewContext('({})')"],
  ['function', '() => ({})'],
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

  it('accepts a null-prototype dictionary', async () => {
    const candidate =
      location === 'root'
        ? "Object.assign(Object.create(null), { pms: ['npm'] })"
        : "{ rules: Object.assign(Object.create(null), { provenance: 'off' }) }";
    writeFileSync(path.join(td.dir, 'siro.config.mjs'), `export default ${candidate};\n`);
    expect(await loadConfig(td.dir)).toStrictEqual(
      location === 'root' ? { pms: ['npm'] } : { rules: { provenance: 'off' } },
    );
  });
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
