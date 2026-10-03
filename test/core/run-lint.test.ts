import { runLint } from '../../src/core/run-lint.ts';
import { createRepositoryEvaluation } from '../../src/core/parse-config-file.ts';
import type { Rule, RuleBinding, VersionNote } from '../../src/core/contracts/rule.ts';
import type { CodecFor, ConfigCodec } from '../../src/core/contracts/config-codec.ts';
import { applyConfig } from '../../src/core/apply-config.ts';
import { asRelPath } from '../../src/core/contracts/paths.ts';
import { makeCtx } from '../helpers/ctx.ts';

// These synthetic bindings test severity and display metadata, not config parsing.
const stubCodecFor: CodecFor = (): ConfigCodec => ({
  parse: (): Record<string, never> => ({}),
});

const makeRule = (options: {
  ruleSeverity: 'error' | 'warn' | 'info';
  bindingSeverity?: 'error' | 'warn' | 'info';
  statusSeverity?: 'error' | 'warn' | 'info';
  versionNote?: VersionNote;
}): Rule => {
  const binding: RuleBinding = {
    check: () => ({
      message: 'always violates',
      severity: options.statusSeverity,
      state: 'violation',
    }),
    file: { kind: 'npmrc', path: asRelPath('.npmrc') },
    severity: options.bindingSeverity,
    versionNote: options.versionNote,
  };
  return {
    bindings: { npm: binding },
    description: 'Exercise severity precedence and display metadata.',
    id: 'severity-probe',
    severity: options.ruleSeverity,
    title: 'Severity probe',
  };
};

it('resolves each severity independently and leaves rule declarations unchanged', () => {
  const rules = [
    { ...makeRule({ ruleSeverity: 'error', bindingSeverity: 'info' }), id: 'binding' },
    { ...makeRule({ ruleSeverity: 'error' }), id: 'fallback' },
    {
      ...makeRule({ ruleSeverity: 'error', bindingSeverity: 'warn', statusSeverity: 'info' }),
      id: 'status',
    },
    { ...makeRule({ ruleSeverity: 'error', bindingSeverity: 'warn' }), id: 'user-binding' },
    { ...makeRule({ ruleSeverity: 'error', statusSeverity: 'info' }), id: 'user-status' },
  ];
  const original = rules.map((rule) => ({
    rule: rule.severity,
    binding: rule.bindings.npm?.severity,
  }));
  const adjusted = applyConfig(rules, { rules: { 'user-binding': 'info', 'user-status': 'warn' } });
  const result = runLint({
    repository: createRepositoryEvaluation(makeCtx(), stubCodecFor),
    targets: [{ pm: 'npm' }],
    ruleSet: adjusted.rules,
    severityOverrides: adjusted.severityOverrides,
  });
  expect(result.findings.map(({ ruleId, severity }) => ({ ruleId, severity }))).toEqual([
    { ruleId: 'binding', severity: 'info' },
    { ruleId: 'fallback', severity: 'error' },
    { ruleId: 'status', severity: 'info' },
    { ruleId: 'user-binding', severity: 'info' },
    { ruleId: 'user-status', severity: 'warn' },
  ]);
  expect(
    rules.map((rule) => ({ rule: rule.severity, binding: rule.bindings.npm?.severity })),
  ).toEqual(original);
});

it.each([
  [undefined, 'always violates'],
  [
    {
      configAvailableSince: 'npm 9.0.0',
      defaultSafeSince: 'npm 11.0.0',
      note: 'Review the target',
    },
    'always violates (available since npm 9.0.0; default safe since npm 11.0.0; Review the target)',
  ],
] satisfies [VersionNote | undefined, string][])(
  'renders version metadata through emitted findings: %j',
  (versionNote, message) => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), stubCodecFor),
      targets: [{ pm: 'npm' }],
      ruleSet: [makeRule({ ruleSeverity: 'error', versionNote })],
    });
    expect(result.findings[0]?.message).toBe(message);
  },
);
