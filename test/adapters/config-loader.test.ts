import assert from 'node:assert';
import { ConfigError } from '../../src/shared/errors.ts';
import { loadConfig } from '../../src/adapters/config-loader.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { type AbsPath, asAbsPath } from '../../src/shared/paths.ts';

const SINGLE = 1;
import path from 'node:path';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

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
      expect(config.customRules).toHaveLength(SINGLE);
    });
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

describe('loadConfig — export shape validation', () => {
  const td = useTempDir();

  it('rejects a config that does not export an object', () => {
    expect.hasAssertions();
    writeFileSync(path.join(td.dir, 'siro.config.mjs'), 'export default 42;\n');
    return expect(loadConfig(td.dir)).rejects.toThrow(/siro.config.mjs must export/u);
  });

  it('rejects a config that default-exports an array with the export-shape error', () => {
    expect.hasAssertions();
    writeFileSync(path.join(td.dir, 'siro.config.mjs'), 'export default [];\n');
    return loadConfig(td.dir)
      .catch((error) => error)
      .then((err) => {
        expect(err).toBeInstanceOf(ConfigError);
        assert(err instanceof Error, 'expected Error');
        expect(err.message).toMatch(/config object/u);
      });
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

  it('rejects a config whose rules map has a severity outside the allowed picklist', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      "export default { rules: { provenance: 'fatal' } };\n",
    );
    return loadConfig(td.dir)
      .catch((error) => error)
      .then((err) => {
        expect(err).toBeInstanceOf(ConfigError);
        assert(err instanceof Error, 'expected Error');
        expect(err.message).toMatch(/rules\.provenance/u);
      });
  });
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

describe('loadConfig — customRules — collisions', () => {
  const td = useTempDir();

  it('rejects a customRules entry whose id collides with a builtin rule id (ambiguous override intent)', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      `export default {
        customRules: [
          { id: 'provenance', title: 't', description: 'd', severity: 'warn', bindings: {} },
        ],
      };\n`,
    );
    return loadConfig(td.dir)
      .catch((error) => error)
      .then((err) => {
        expect(err).toBeInstanceOf(ConfigError);
        assert(err instanceof Error, 'expected Error');
        expect(err.message).toMatch(/provenance/u);
        expect(err.message).toMatch(/collide|duplicate|builtin/iu);
      });
  });

  it('rejects two customRules entries in the same config that share the same id', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(td.dir, 'siro.config.mjs'),
      `export default {
        customRules: [
          { id: 'demo-rule', title: 't', description: 'd', severity: 'warn', bindings: {} },
          { id: 'demo-rule', title: 't2', description: 'd2', severity: 'error', bindings: {} },
        ],
      };\n`,
    );
    return loadConfig(td.dir)
      .catch((error) => error)
      .then((err) => {
        expect(err).toBeInstanceOf(ConfigError);
        assert(err instanceof Error, 'expected Error');
        expect(err.message).toMatch(/demo-rule/u);
        expect(err.message).toMatch(/duplicate|collide/iu);
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
      expect(config.customRules).toHaveLength(SINGLE);
      expect(config.reporters).toHaveLength(SINGLE);
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
