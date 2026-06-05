import { ConfigError, UsageError } from '../../src/shared/errors.ts';
import { asAbsPath, asRelPath } from '../../src/shared/paths.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Rule } from '../../src/domain/entities/rule.ts';
import { captureIO } from '../helpers/io.ts';
import { lintCommand } from '../../src/application/commands/lint.ts';
import { npmGoodFs } from '../helpers/fixtures.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

const EXIT_VIOLATION = 1;
const SINGLE_OCCURRENCE = 1;

const customAlwaysViolates: Rule = {
  bindings: {
    npm: {
      check: () => ({ message: 'synthetic violation', state: 'violation' }),
      file: { kind: 'npmrc', path: asRelPath('.npmrc') },
      fix: () => [],
      fixKind: 'auto',
    },
  },
  description: 'synthetic rule for embedder injection tests',
  id: 'custom-always-violates',
  severity: 'error',
  title: 'always violates',
};

const ruleWithId = (id: string): Rule => ({
  bindings: customAlwaysViolates.bindings,
  description: customAlwaysViolates.description,
  id,
  severity: customAlwaysViolates.severity,
  title: customAlwaysViolates.title,
});

const brokenReporterObj = JSON.parse('{"name":"broken"}');

const rejectAsConfigError = (promise: Promise<unknown>): Promise<ConfigError> =>
  promise.then(
    () => {
      throw new Error('expected rejection');
    },
    (error: unknown) => {
      if (error instanceof ConfigError) {
        return error;
      }
      throw error;
    },
  );

const assertDedupCollisionMessage = (err: ConfigError): void => {
  expect(err).toBeInstanceOf(ConfigError);
  const occurrences = err.message.split("'dup'").length - SINGLE_OCCURRENCE;
  expect(occurrences).toBe(SINGLE_OCCURRENCE);
  expect(err.message).toContain('rule id ');
  expect(err.message).not.toContain('rule ids ');
};

const assertUnknownRuleIdsMessage = (err: ConfigError): void => {
  expect(err).toBeInstanceOf(ConfigError);
  expect(err.message).toMatch(/unknown rule ids/u);
  expect(err.message).toContain("'typo-one'");
  expect(err.message).toContain("'typo-two'");
  expect(err.message).not.toContain("'provenance'");
};

const setupDiskDir = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siro-lint-collision-'));
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'demo', packageManager: 'npm@10.9.0', version: '1.0.0' }),
  );
  return dir;
};

describe('lintCommand customRules — reporter validation', () => {
  it('rejects an object `reporter` that is missing format (UsageError)', () => {
    expect.hasAssertions();
    const fs = npmGoodFs();
    const { io } = captureIO();
    return expect(
      lintCommand({ cwd: asAbsPath('/repo'), fs, reporter: brokenReporterObj }, io),
    ).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects a malformed entry in the `reporters` list (UsageError)', () => {
    expect.hasAssertions();
    const fs = npmGoodFs();
    const { io } = captureIO();
    return expect(
      lintCommand({ cwd: asAbsPath('/repo'), fs, reporters: [brokenReporterObj] }, io),
    ).rejects.toBeInstanceOf(UsageError);
  });
});

describe('lintCommand customRules — injection and collision', () => {
  it('evaluates a programmatically injected custom rule', () => {
    expect.hasAssertions();
    const fs = npmGoodFs();
    const { io } = captureIO();
    return lintCommand(
      { customRules: [customAlwaysViolates], cwd: asAbsPath('/repo'), fs, reporter: 'json' },
      io,
    ).then((code) => {
      expect(code).toBe(EXIT_VIOLATION);
    });
  });

  it('throws ConfigError when a programmatic rule id collides with a builtin', () => {
    expect.hasAssertions();
    const collidingRule = ruleWithId('frozen-lockfile');
    const fs = npmGoodFs();
    const { io } = captureIO();
    return expect(
      lintCommand(
        { customRules: [collidingRule], cwd: asAbsPath('/repo'), fs, reporter: 'json' },
        io,
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it('throws ConfigError when two programmatic customRules share an id', () => {
    expect.hasAssertions();
    const dupOne = ruleWithId('duplicate-id');
    const dupTwo = ruleWithId('duplicate-id');
    const fs = npmGoodFs();
    const { io } = captureIO();
    return expect(
      lintCommand(
        { customRules: [dupOne, dupTwo], cwd: asAbsPath('/repo'), fs, reporter: 'json' },
        io,
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});

describe('lintCommand customRules — plural phrasing', () => {
  it('uses plural phrasing when two distinct ids collide with builtins', () => {
    expect.hasAssertions();
    const frozenRule = ruleWithId('frozen-lockfile');
    const provRule = ruleWithId('provenance');
    const fs = npmGoodFs();
    const { io } = captureIO();
    return rejectAsConfigError(
      lintCommand(
        { customRules: [frozenRule, provRule], cwd: asAbsPath('/repo'), fs, reporter: 'json' },
        io,
      ),
    ).then((err) => {
      expect(err).toBeInstanceOf(ConfigError);
      expect(err.message).toContain('rule ids ');
      expect(err.message).toContain("'frozen-lockfile'");
      expect(err.message).toContain("'provenance'");
    });
  });
});

describe('lintCommand customRules — dedup collision message', () => {
  it('reports each colliding rule id at most once', () => {
    expect.hasAssertions();
    const dupOne = ruleWithId('dup');
    const dupTwo = ruleWithId('dup');
    const dupThree = ruleWithId('dup');
    const fs = npmGoodFs();
    const { io } = captureIO();
    return rejectAsConfigError(
      lintCommand(
        { customRules: [dupOne, dupTwo, dupThree], cwd: asAbsPath('/repo'), fs, reporter: 'json' },
        io,
      ),
    ).then((err) => {
      assertDedupCollisionMessage(err);
    });
  });
});

describe('lintCommand customRules — disk-loaded config: unknown ids', () => {
  let dir = '';

  beforeEach(() => {
    dir = setupDiskDir();
  });

  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  it('rejects an unknown rule id in `rules`', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      "export default { rules: { 'no-such-rule': 'warn' } };\n",
    );
    const { io } = captureIO();
    return expect(
      lintCommand({ cwd: asAbsPath(dir), reporter: 'json' }, io),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it('pluralises and lists every unknown rule id once', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      "export default { rules: { provenance: 'off', 'typo-one': 'warn', 'typo-two': 'error' } };\n",
    );
    const { io } = captureIO();
    return rejectAsConfigError(lintCommand({ cwd: asAbsPath(dir), reporter: 'json' }, io)).then(
      (err) => {
        assertUnknownRuleIdsMessage(err);
      },
    );
  });
});

describe('lintCommand customRules — disk-loaded config: cross-source', () => {
  let dir = '';

  beforeEach(() => {
    dir = setupDiskDir();
  });

  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  it('accepts a `rules` override referencing a programmatic custom rule', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      `export default {
        rules: { 'custom-always-violates': 'warn' },
      };\n`,
    );
    const { io } = captureIO();
    return lintCommand(
      { customRules: [customAlwaysViolates], cwd: asAbsPath(dir), reporter: 'json' },
      io,
    ).then((code) => {
      expect(code).toBe(EXIT_VIOLATION);
    });
  });

  it('throws ConfigError when a programmatic rule id collides with a config customRule', () => {
    expect.hasAssertions();
    writeFileSync(
      path.join(dir, 'siro.config.mjs'),
      `export default {
        customRules: [
          { id: 'shared-id', title: 't', description: 'd', severity: 'warn', bindings: {} },
        ],
      };\n`,
    );
    const programmaticShared = ruleWithId('shared-id');
    const { io } = captureIO();
    return expect(
      lintCommand({ customRules: [programmaticShared], cwd: asAbsPath(dir), reporter: 'json' }, io),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});
