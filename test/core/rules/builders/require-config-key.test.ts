import { bindingForTest } from '../../../helpers/rules.ts';

import type { ConfigFileRef } from '../../../../src/core/contracts/config-file-ref.ts';
import { CONFIG_FILES } from '../../../../src/core/config-files.ts';
import type { Rule, VersionNote } from '../../../../src/core/contracts/rule.ts';
import { requireConfigKey } from '../../../../src/core/rules/builders/require-config-key.ts';
import { asRelPath } from '../../../../src/core/contracts/paths.ts';
import { makeCtx } from '../../../helpers/ctx.ts';

const npmrc: ConfigFileRef = { kind: 'npmrc', path: asRelPath('.npmrc') };

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
        keyPath: ['k'],
        message: 'Pin the key explicitly.',
        value: true,
        versionNote,
      },
    },
    description: 'd',
    id: 'version-note',
    severity: 'error',
    title: 't',
  });
};

describe('requireConfigKey passes spec.severity into binding', () => {
  it('copies an explicit binding severity and otherwise leaves it unset', () => {
    const bindingSeverity = (severity?: 'info') => {
      const rule = requireConfigKey({
        bindings: {
          npm: {
            file: npmrc,
            keyPath: ['x'],
            message: 'm',
            severity,
            value: true,
          },
        },
        description: 'd',
        id: 'test-d1',
        severity: 'error',
        title: 't',
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
