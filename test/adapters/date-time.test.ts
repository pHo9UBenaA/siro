import { execFileSync } from 'node:child_process';

it.each([
  ['UTC', 'violation'],
  ['Asia/Tokyo', 'ok'],
])('preserves native offsetless date semantics in %s', (timezone, expected) => {
  const rulesUrl = new URL('../../src/runtime.ts', import.meta.url).href;
  const probe = `
    import { rules } from ${JSON.stringify(rulesUrl)};
    Date.now = () => Date.parse('2030-01-01T00:00:00Z');
    const rule = rules.find((candidate) => candidate.id === 'minimum-release-age');
    const ctx = { root: '/virtual', exists: () => false, readText: () => undefined,
      readConfig: () => ({}), packageJson: undefined };
    process.stdout.write(rule.bindings.npm.check(ctx, { before: '2030-01-01T00:00:00' }).state);
  `;
  expect(
    execFileSync(process.execPath, ['--input-type=module', '--eval', probe], {
      encoding: 'utf8',
      env: { ...process.env, TZ: timezone },
      timeout: 5000,
    }),
  ).toBe(expected);
});
