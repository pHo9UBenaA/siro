import type { CheckStatus, Rule, RuleBinding } from '../../../src/domain/entities/rule.ts';
import { asRelPath } from '../../../src/shared/paths.ts';
import { decideSeverity } from '../../../src/domain/services/decide-severity.ts';

vi.setConfig({ testTimeout: 5000 });

type Violation = Extract<CheckStatus, { state: 'violation' }>;

const violation = (severity?: Violation['severity']): Violation => ({
  message: 'irrelevant',
  severity,
  state: 'violation',
});

const rule = (severity: Rule['severity']): Rule => ({
  bindings: {},
  description: 'd',
  id: 'r',
  severity,
  title: 't',
});

const binding = (severity?: RuleBinding['severity']): RuleBinding => ({
  check: (): CheckStatus => ({ state: 'ok' }),
  file: { kind: 'npmrc', path: asRelPath('.npmrc') },
  fix: (): readonly [] => [],
  fixKind: 'auto',
  severity,
});

describe('decideSeverity (runtime precedence)', () => {
  it('returns rule.severity when neither status nor binding offers one', () => {
    expect.hasAssertions();
    expect(decideSeverity(violation(), binding(), rule('error'))).toBe('error');
  });

  it('returns binding.severity when status has none', () => {
    expect.hasAssertions();
    expect(decideSeverity(violation(), binding('warn'), rule('error'))).toBe('warn');
  });

  it('returns status.severity when set (dynamic per-violation override)', () => {
    expect.hasAssertions();
    expect(decideSeverity(violation('info'), binding('warn'), rule('error'))).toBe('info');
  });

  it('lets status.severity downgrade past binding.severity even when binding sets a stricter level', () => {
    expect.hasAssertions();
    expect(decideSeverity(violation('info'), binding('warn'), rule('error'))).toBe('info');
  });
});
