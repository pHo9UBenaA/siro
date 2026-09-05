import { ConfigError, UsageError } from '../../src/shared/errors.ts';
import { asAbsPath, asRelPath } from '../../src/shared/paths.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { CheckStatus, Rule } from '../../src/domain/entities/rule.ts';
import type { LintResult } from '../../src/domain/entities/lint-result.ts';
import { captureIO } from '../helpers/io.ts';
import { lintCommand } from '../../src/application/commands/lint.ts';
import { npmGoodFs } from '../helpers/fixtures.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

const EXIT_VIOLATION = 1;
const SINGLE_OCCURRENCE = 1;
const SPARSE_ARRAY_LENGTH = 1;
const sparseManualSteps = new Array<string>(SPARSE_ARRAY_LENGTH);

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

  it('rejects a non-array `reporters` value (UsageError)', () => {
    expect.hasAssertions();
    const fs = npmGoodFs();
    const { io } = captureIO();
    const reporters = { format: () => '', name: 'object-not-list' } as unknown as [];
    return expect(
      lintCommand({ cwd: asAbsPath('/repo'), fs, reporters }, io),
    ).rejects.toBeInstanceOf(UsageError);
  });
});

describe('lintCommand customRules — injection and collision', () => {
  it('rejects a sparse programmatic customRules array (UsageError)', () => {
    expect.hasAssertions();
    const customRules = new Array<Rule>(SPARSE_ARRAY_LENGTH);
    const fs = npmGoodFs();
    const { io } = captureIO();
    return expect(
      lintCommand({ customRules, cwd: asAbsPath('/repo'), fs, reporter: 'json' }, io),
    ).rejects.toBeInstanceOf(UsageError);
  });

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

  it.each([
    { message: 'missing state', status: {} },
    {
      message: 'invalid severity',
      status: { message: 'x', severity: 'fatal', state: 'violation' },
    },
    {
      message: 'non-scalar expected value',
      status: { expected: { nested: true }, message: 'x', state: 'violation' },
    },
    {
      message: 'non-finite expected value',
      status: { expected: Number.NaN, message: 'x', state: 'violation' },
    },
    {
      message: 'sparse manual steps',
      status: { manualSteps: sparseManualSteps, message: 'x', state: 'violation' },
    },
  ])('rejects a custom rule check result with $message', ({ status }) => {
    expect.hasAssertions();
    const invalidRule: Rule = {
      ...ruleWithId('invalid-check-result'),
      bindings: {
        npm: {
          check: () => status as CheckStatus,
          file: { kind: 'npmrc', path: asRelPath('.npmrc') },
          fix: () => [],
          fixKind: 'auto',
        },
      },
    };
    const fs = npmGoodFs();
    const { io } = captureIO();
    return expect(
      lintCommand(
        { customRules: [invalidRule], cwd: asAbsPath('/repo'), fs, reporter: 'json' },
        io,
      ),
    ).rejects.toThrow("Rule 'invalid-check-result' returned an invalid check result.");
  });

  it.each([
    { fixKind: 'auto', name: 'a non-array value', result: null },
    {
      fixKind: 'auto',
      name: 'an advisory operation from an auto binding',
      result: [{ message: 'manual', op: 'note' }],
    },
    {
      fixKind: 'advisory',
      name: 'a write operation from an advisory binding',
      result: [
        {
          file: { kind: 'npmrc', path: asRelPath('.npmrc') },
          keyPath: ['key'],
          op: 'setKey',
          value: true,
        },
      ],
    },
    {
      fixKind: 'auto',
      name: 'a write targeting a file glob',
      result: [
        {
          file: { kind: 'fileGlob', path: asRelPath('*.lock') },
          keyPath: ['key'],
          op: 'setKey',
          value: true,
        },
      ],
    },
    {
      fixKind: 'auto',
      name: 'a write with a non-finite value',
      result: [
        {
          file: { kind: 'npmrc', path: asRelPath('.npmrc') },
          keyPath: ['key'],
          op: 'setKey',
          value: Number.POSITIVE_INFINITY,
        },
      ],
    },
  ] as const)('rejects a custom rule that returns $name', ({ fixKind, result }) => {
    expect.hasAssertions();
    const invalidRule: Rule = {
      ...ruleWithId('invalid-fix-result'),
      bindings: {
        npm: {
          check: () => ({ message: 'x', state: 'violation' }),
          file: { kind: 'npmrc', path: asRelPath('.npmrc') },
          fix: () => result as never,
          fixKind,
        },
      },
    };
    const fs = npmGoodFs();
    const { io } = captureIO();
    return expect(
      lintCommand(
        { customRules: [invalidRule], cwd: asAbsPath('/repo'), fs, reporter: 'json' },
        io,
      ),
    ).rejects.toThrow("Rule 'invalid-fix-result' returned invalid fix operations.");
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

  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'preserves error findings for %s when rules overrides are empty',
    (id) => {
      expect.hasAssertions();
      writeFileSync(path.join(dir, 'siro.config.mjs'), 'export default { rules: {} };\n');
      writeFileSync(
        path.join(dir, '.npmrc'),
        'ignore-scripts=true\nsave-exact=true\nsave-prefix=\n',
      );
      writeFileSync(path.join(dir, 'package-lock.json'), '{}\n');
      const { io, out } = captureIO();
      return lintCommand(
        { customRules: [ruleWithId(id)], cwd: asAbsPath(dir), reporter: 'json' },
        io,
      ).then((code) => {
        const result: LintResult = JSON.parse(out());
        const severities = result.findings
          .filter((finding) => finding.ruleId === id)
          .map((finding) => finding.severity);
        expect({ code, severities }).toStrictEqual({ code: EXIT_VIOLATION, severities: ['error'] });
      });
    },
  );

  it.each(['custom-always-violates', 'constructor', 'prototype', '__proto__', 'toString'])(
    'accepts an own rules override for the %s programmatic custom rule',
    (id) => {
      expect.hasAssertions();
      writeFileSync(
        path.join(dir, 'siro.config.mjs'),
        `export default {
        rules: { [${JSON.stringify(id)}]: 'warn' },
      };\n`,
      );
      const { io, out } = captureIO();
      return lintCommand(
        { customRules: [ruleWithId(id)], cwd: asAbsPath(dir), reporter: 'json' },
        io,
      ).then((code) => {
        const result: LintResult = JSON.parse(out());
        const severity = result.findings.find((finding) => finding.ruleId === id)?.severity;
        expect({ code, severity }).toStrictEqual({ code: EXIT_VIOLATION, severity: 'warn' });
      });
    },
  );

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
