import { CONFIG_FILES } from '../../../../src/core/config-files.ts';
import {
  requireConfigKey,
  type RequireConfigKeySpec,
} from '../../../../src/core/rules/builders/require-config-key.ts';
import { makeCtx } from '../../../helpers/ctx.ts';
import { bindingForTest } from '../../../helpers/rules.ts';

const checkDefault = (
  options: Pick<
    RequireConfigKeySpec,
    'defaultSafety' | 'documentedDefault' | 'defaultSatisfiedSeverity' | 'versionNote'
  >,
) => {
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
        ...options,
      },
    },
  });
  return bindingForTest(rule, 'npm').check(makeCtx(), {});
};

it.each([
  { safety: undefined, defaultValue: 3, severity: undefined, state: 'violation' },
  { safety: 'conditional', defaultValue: 3, severity: undefined, state: 'violation' },
  { safety: 'unconditional', defaultValue: 3, severity: 'info', state: 'violation' },
  { safety: 'unconditional', defaultValue: 0, severity: undefined, state: 'violation' },
  { safety: 'unconditional', defaultValue: 3, satisfied: 'off', severity: undefined, state: 'ok' },
] as const)(
  'uses explicit safety and the accept predicate: %j',
  ({ safety, defaultValue, severity, state, ...options }) => {
    const status = checkDefault({
      defaultSafety: safety,
      documentedDefault: defaultValue,
      defaultSatisfiedSeverity: 'satisfied' in options ? options.satisfied : undefined,
    });
    expect(status.state).toBe(state);
    const actualSeverity = status.state === 'violation' ? status.severity : undefined;
    expect(actualSeverity).toBe(severity);
  },
);

it.each([undefined, 'some version', 'different note'])(
  'keeps display-only version metadata out of the safe-default decision: %s',
  (note) => {
    const status = checkDefault({
      defaultSafety: 'unconditional',
      documentedDefault: 3,
      versionNote: note === undefined ? undefined : { defaultSafeSince: note },
    });
    expect(status).toMatchObject({ state: 'violation', severity: 'info' });
  },
);
