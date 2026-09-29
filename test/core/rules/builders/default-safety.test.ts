import { CONFIG_FILES } from '../../../../src/core/config-files.ts';
import { requireConfigKey } from '../../../../src/core/rules/builders/require-config-key.ts';
import { makeCtx } from '../../../helpers/ctx.ts';

it.each([
  { safety: undefined, defaultValue: 3, severity: undefined, state: 'violation' },
  { safety: 'conditional', defaultValue: 3, severity: undefined, state: 'violation' },
  { safety: 'unconditional', defaultValue: 3, severity: 'info', state: 'violation' },
  { safety: 'unconditional', defaultValue: 0, severity: undefined, state: 'violation' },
  { safety: 'unconditional', defaultValue: 3, satisfied: 'off', severity: undefined, state: 'ok' },
] as const)(
  'uses explicit safety and the accept predicate: %j',
  ({ safety, defaultValue, severity, state, ...options }) => {
    const statuses = [undefined, 'some version', 'different note'].map((note) => {
      const rule = requireConfigKey({
        id: 'default-predicate',
        title: 't',
        description: 'd',
        severity: 'error',
        bindings: {
          npm: {
            file: CONFIG_FILES.npmrc,
            keyPath: ['age'],
            value: 7,
            accept: (value) => typeof value === 'number' && value > 0,
            message: 'pin age',
            documentedDefault: defaultValue,
            defaultSafety: safety,
            defaultSatisfiedSeverity: 'satisfied' in options ? options.satisfied : undefined,
            versionNote: note === undefined ? undefined : { defaultSafeSince: note },
          },
        },
      });
      return rule.bindings.npm?.check(makeCtx(), {});
    });
    expect(statuses[0]).toEqual(statuses[1]);
    expect(statuses[1]).toEqual(statuses[2]);
    expect(statuses[0]?.state).toBe(state);
    expect(Object.getOwnPropertyDescriptor(statuses[0], 'severity')?.value).toBe(severity);
  },
);
