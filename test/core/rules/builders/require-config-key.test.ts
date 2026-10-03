import { bindingForTest } from '../../../helpers/rules.ts';
import type { ConfigFileRef } from '../../../../src/core/contracts/config-file-ref.ts';
import { CONFIG_FILES } from '../../../../src/core/config-files.ts';
import type { Rule, VersionNote } from '../../../../src/core/contracts/rule.ts';
import {
  asAbsPath,
  ConfigError,
  lint,
  requireConfigKey,
  type RequireConfigKeySpec,
} from '../../../../src/index.ts';
import { asRelPath } from '../../../../src/core/contracts/paths.ts';
import { makeCtx } from '../../../helpers/ctx.ts';

const npmrc: ConfigFileRef = { kind: 'npmrc', path: asRelPath('.npmrc') };
const helperOptions = {
  id: 'company-policy',
  title: 'Company policy',
  description: 'Require the approved setting',
  severity: 'error',
};
const helperSpec: RequireConfigKeySpec = {
  file: npmrc,
  keyPath: ['approved'],
  value: true,
  message: 'Enable approved',
};

// Exercise the JavaScript boundary without asserting invalid input has a valid TypeScript type.
const lintUntypedHelper = (options: unknown): unknown => {
  const rule: unknown = Reflect.apply(requireConfigKey, undefined, [options]);
  return Reflect.apply(lint, undefined, [
    {
      cwd: asAbsPath('/virtual'),
      pm: 'npm',
      installationRoots: [],
      fs: { readDirectories: () => [], exists: () => false, readText: () => undefined },
      config: { customRules: [rule] },
    },
  ]);
};

describe('requireConfigKey JavaScript bindings', () => {
  it('rejects an unknown PM key instead of silently dropping the policy', () => {
    expect(() => lintUntypedHelper({ ...helperOptions, bindings: { nmp: helperSpec } })).toThrow(
      /bindings.*nmp/,
    );
  });

  it.each([
    { name: 'null', bindings: null },
    { name: 'array', bindings: [] },
    { name: 'inherited bindings', bindings: Object.create({ npm: helperSpec }) },
  ])('rejects $name rather than normalizing it into a valid rule', ({ bindings }) => {
    expect(() => lintUntypedHelper({ ...helperOptions, bindings })).toThrow(ConfigError);
  });

  it('accepts an empty map and a null-prototype map with an own binding', () => {
    expect(lintUntypedHelper({ ...helperOptions, bindings: {} })).toMatchObject({ findings: [] });
    const bindings: unknown = Object.assign(Object.create(null), { npm: helperSpec });
    expect(lintUntypedHelper({ ...helperOptions, bindings })).toMatchObject({
      findings: [{ ruleId: 'company-policy', severity: 'error' }],
    });
  });
});

const invalidPredicates = [
  { name: 'resolved Promise', predicate: async () => false, error: /synchronous/ },
  {
    name: 'rejected Promise',
    predicate: () => Promise.reject(new Error('predicate rejected')),
    error: /synchronous/,
  },
  {
    name: 'rejecting thenable',
    predicate: () => ({
      then(_resolve: unknown, reject: (error: Error) => void) {
        reject(new Error('thenable rejected'));
      },
    }),
    error: /synchronous/,
  },
  { name: 'nonboolean object', predicate: () => ({}), error: /boolean/ },
];

it.each(invalidPredicates)('rejects accept returning a $name', async ({ predicate, error }) => {
  expect(() =>
    lintUntypedHelper({
      ...helperOptions,
      bindings: { npm: { ...helperSpec, accept: predicate } },
    }),
  ).toThrow(error);
  // Vitest reports any rejection escaping the synchronous boundary after this turn.
  await new Promise<void>((resolve) => setImmediate(resolve));
});

it.each(invalidPredicates)('rejects applies returning a $name', async ({ predicate, error }) => {
  expect(() =>
    lintUntypedHelper({
      ...helperOptions,
      bindings: { npm: helperSpec },
      applies: predicate,
    }),
  ).toThrow(error);
  await new Promise<void>((resolve) => setImmediate(resolve));
});

it('validates accept when checking an unconditional documented default', () => {
  expect(() =>
    lintUntypedHelper({
      ...helperOptions,
      bindings: {
        npm: {
          ...helperSpec,
          documentedDefault: true,
          defaultSafety: 'unconditional',
          accept: async () => false,
        },
      },
    }),
  ).toThrow(/synchronous/);
});

it('preserves synchronous false and short-circuits acceptance when applies is false', () => {
  expect(
    lintUntypedHelper({
      ...helperOptions,
      bindings: { npm: { ...helperSpec, accept: () => false } },
    }),
  ).toMatchObject({ findings: [{ ruleId: 'company-policy', severity: 'error' }] });
  const accept = vi.fn<() => boolean>(() => true);
  expect(
    lintUntypedHelper({
      ...helperOptions,
      bindings: { npm: { ...helperSpec, accept } },
      applies: () => false,
    }),
  ).toMatchObject({ findings: [] });
  expect(accept).not.toHaveBeenCalled();
});

it.each([
  ['11.9.0', 'manual'],
  ['11.10.0', 'automatic'],
])('guards npm min-release-age remediation at version %s', (pmVersion, kind) => {
  const rule = requireConfigKey({
    id: 'age',
    title: 'Age',
    description: 'Age policy',
    severity: 'warn',
    bindings: {
      npm: { file: npmrc, keyPath: ['min-release-age'], value: 3, message: 'Set an age.' },
    },
  });
  expect(bindingForTest(rule, 'npm').check(makeCtx({ pmVersion }), {})).toMatchObject({
    state: 'violation',
    remediation: { kind },
  });
});

const ruleWithVersionNote = (versionNote?: VersionNote): Rule => {
  return requireConfigKey({
    bindings: {
      npm: {
        file: npmrc,
        keyPath: ['enabled'],
        message: 'Pin the key explicitly.',
        value: true,
        versionNote,
      },
    },
    description: 'Carry display metadata without changing the check result.',
    id: 'version-note',
    severity: 'error',
    title: 'Version note',
  });
};

describe('requireConfigKey passes spec.severity into binding', () => {
  it('copies an explicit binding severity and otherwise leaves it unset', () => {
    const bindingSeverity = (severity?: 'info') => {
      const rule = requireConfigKey({
        bindings: {
          npm: {
            file: npmrc,
            keyPath: ['enabled'],
            message: 'Enable the policy.',
            severity,
            value: true,
          },
        },
        description: 'Preserve the optional binding severity.',
        id: 'binding-severity',
        severity: 'error',
        title: 'Binding severity',
      });
      return bindingForTest(rule, 'npm').severity;
    };
    expect([bindingSeverity('info'), bindingSeverity()]).toStrictEqual(['info', undefined]);
  });
});

describe('versionNote metadata', () => {
  const binding = (versionNote?: VersionNote) =>
    bindingForTest(ruleWithVersionNote(versionNote), 'npm');

  it('copies structured metadata without putting presentation data in the check result', () => {
    const withMetadata = binding({ configAvailableSince: 'npm 9.0.0' });
    const check = withMetadata.check(makeCtx(), {});
    expect({
      absent: binding().versionNote,
      versionNote: withMetadata.versionNote,
    }).toStrictEqual({
      absent: undefined,
      versionNote: { configAvailableSince: 'npm 9.0.0' },
    });
    expect(check).not.toHaveProperty('versionNote');
    expect(check).toMatchObject({ message: 'Pin the key explicitly.', state: 'violation' });
  });
});

it('rejects legacy extraFix options instead of silently discarding part of a policy', () => {
  const spec = {
    file: CONFIG_FILES.npmrc,
    keyPath: ['enabled'] as const,
    value: true,
    message: 'Enable the policy.',
    extraFix: [{ keyPath: ['second'], value: true }],
  };
  expect(() =>
    requireConfigKey({
      id: 'legacy-options',
      title: 'Legacy',
      description: 'Legacy options',
      severity: 'error',
      bindings: { npm: spec },
    }),
  ).toThrow(/extraFix.*custom binding/u);
});
