import { safeText, safeJsonText } from '../../src/adapters/safe-text.ts';

it.each([
  '::error::fake',
  '  ::add-mask::fake',
  'path##[error]fake',
  'path\r\n::warning::fake',
  '\u001b[2J\u0085\u202e\u2066',
])('renders untrusted text without command openers or display controls: %j', (value) => {
  const text = safeText(value);
  expect(text).not.toContain('##[');
  expect(text).not.toMatch(/^\s*::/u);
  expect(text).not.toContain('\n');
  expect(text).not.toContain('\r');
  expect(text).not.toContain('\u001b');
  expect(text).not.toContain('\u202e');
});

it('retains JSON keys, values and literal escapes without exposing legacy commands', () => {
  const data = {
    '##[error]key': '##[add-mask]value\u0085\u202e',
    literal: '\\u0023\\n%0A',
    newline: '\n',
  };
  const text = safeJsonText(JSON.stringify(data, null, 2));
  expect(text).not.toContain('##[');
  expect(JSON.parse(text)).toEqual(data);
});
