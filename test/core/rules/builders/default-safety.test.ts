import { CONFIG_FILES } from '../../../../src/core/config-files.ts';
import {
  requireConfigKey,
  type RequireConfigKeySpec,
} from '../../../../src/core/rules/builders/require-config-key.ts';
import { makeCtx } from '../../../helpers/ctx.ts';
import { bindingForTest } from '../../../helpers/rules.ts';

type DefaultOptions = Pick<
  RequireConfigKeySpec,
  'defaultSafety' | 'documentedDefault' | 'defaultSatisfiedSeverity' | 'versionNote'
>;

const checkDefault = (options: DefaultOptions) => {
  const rule = requireConfigKey({
    id: 'default-predicate',
    title: 'Default predicate',
    description: 'Check safe defaults with a positive release-age predicate.',
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

it.each<
  DefaultOptions & {
    expectedState: 'violation' | 'ok';
    expectedSeverity?: RequireConfigKeySpec['severity'];
  }
>([
  { documentedDefault: 3, expectedState: 'violation' },
  { defaultSafety: 'conditional', documentedDefault: 3, expectedState: 'violation' },
  {
    defaultSafety: 'unconditional',
    documentedDefault: 3,
    expectedState: 'violation',
    expectedSeverity: 'info',
  },
  { defaultSafety: 'unconditional', documentedDefault: 0, expectedState: 'violation' },
  {
    defaultSafety: 'unconditional',
    documentedDefault: 3,
    defaultSatisfiedSeverity: 'off',
    expectedState: 'ok',
  },
])(
  'uses explicit safety and the accept predicate: %j',
  ({ expectedState, expectedSeverity, ...options }) => {
    const status = checkDefault(options);
    expect(status.state).toBe(expectedState);
    const actualSeverity = status.state === 'violation' ? status.severity : undefined;
    expect(actualSeverity).toBe(expectedSeverity);
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
