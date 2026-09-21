import { CONFIG_FILES } from '../../../src/domain/entities/config-files.ts';
import { proposeChanges } from '../../../src/domain/rules/remediation.ts';

const operation = {
  file: CONFIG_FILES.bunfig,
  keyPath: ['install', 'exact'],
  op: 'setKey',
  value: true,
} as const;

it('allows a scalar write when its parent path is absent', () => {
  expect(proposeChanges({}, [operation])).toStrictEqual({
    kind: 'automatic',
    operations: [operation],
  });
});

it('requires manual review instead of replacing a non-object parent', () => {
  expect(proposeChanges({ install: false }, [operation])).toMatchObject({
    kind: 'manual',
    steps: [expect.stringMatching(/non-object parent/u)],
  });
});

it('requires manual review instead of replacing a settings container', () => {
  expect(proposeChanges({ install: { exact: { legacy: true } } }, [operation])).toMatchObject({
    kind: 'manual',
    steps: [expect.stringMatching(/contains nested settings/u)],
  });
});
