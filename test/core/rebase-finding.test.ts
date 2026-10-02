import { rebaseFinding } from '../../src/core/rebase-finding.ts';
import { asRelPath } from '../../src/core/contracts/paths.ts';
import { type Remediation } from '../../src/core/contracts/rule.ts';
import { type Finding } from '../../src/core/contracts/lint-result.ts';

describe('Path rebasing', () => {
  it.each<[string, Remediation | undefined, Remediation | undefined]>([
    ['absent remediation', undefined, undefined],
    [
      'manual guidance',
      { kind: 'manual', steps: ['Review settings.'] },
      { kind: 'manual', steps: ['Work in child for this finding.', 'Review settings.'] },
    ],
    [
      'automatic operations in multiple files',
      {
        kind: 'automatic',
        operations: [
          {
            op: 'setKey',
            file: { kind: 'json', path: asRelPath('package.json') },
            keyPath: ['publishConfig', 'provenance'],
            value: true,
          },
          {
            op: 'setKey',
            file: { kind: 'npmrc', path: asRelPath('.npmrc') },
            keyPath: ['provenance'],
            value: true,
          },
        ],
      },
      {
        kind: 'automatic',
        operations: [
          {
            op: 'setKey',
            file: { kind: 'json', path: asRelPath('child/package.json') },
            keyPath: ['publishConfig', 'provenance'],
            value: true,
          },
          {
            op: 'setKey',
            file: { kind: 'npmrc', path: asRelPath('child/.npmrc') },
            keyPath: ['provenance'],
            value: true,
          },
        ],
      },
    ],
  ])('rebases %s immutably without inventing a finding file', (_name, remediation, expected) => {
    const finding: Finding = {
      ruleId: 'test',
      directory: '.',
      severity: 'warn',
      message: 'Review.',
      remediation,
    };
    const original = structuredClone(finding);
    const root = rebaseFinding(asRelPath('.'), finding);
    const child = rebaseFinding(asRelPath('child'), finding);
    expect(root).toEqual(original);
    expect(child.file).toBeUndefined();
    expect(child.directory).toBe('child');
    expect(child.remediation).toEqual(expected);
    expect(finding).toEqual(original);
  });
});
