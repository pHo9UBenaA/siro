import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parse } from 'yaml';

const validate = (input: string) => {
  const workflow = parse(
    readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/publish.yaml'), 'utf8'),
  );
  const script = workflow.jobs.publish.steps.find((step: { run?: string }) =>
    step.run?.includes('npm stage publish'),
  ).run as string;
  const program = /node --input-type=module -e '([\s\S]*?)'/u.exec(script)?.[1];
  if (program === undefined) throw new Error('Staging must inspect the packed package identity.');
  expect(script.indexOf('sha256sum --check --strict')).toBeLessThan(script.indexOf('tar -xOzf'));
  expect(script.indexOf('tar -xOzf')).toBeLessThan(script.indexOf('npm stage publish'));
  return spawnSync(process.execPath, ['--input-type=module', '-e', program], {
    encoding: 'utf8',
    input,
    timeout: 5000,
    maxBuffer: 1024 * 1024,
    env: { RELEASE_VERSION: '0.6.1' },
  });
};
const identity = { name: '@pho9ubenaa/siro', version: '0.6.1' };
it.each([
  { value: identity, valid: true },
  { value: { ...identity, name: 'other' }, valid: false },
  { value: { ...identity, version: '0.6.2' }, valid: false },
  { value: { ...identity, private: true }, valid: false },
  { value: null, valid: false },
])('validates packed identity as data: $value', ({ value, valid }) => {
  const result = validate(JSON.stringify(value));
  expect(result.error).toBeUndefined();
  expect(result.status === 0).toBe(valid);
  expect(result.stdout).toBe('');
});
it('bounds metadata bytes before parsing and does not disclose input on failure', () => {
  const json = JSON.stringify(identity);
  expect(validate(json.padEnd(65536)).status).toBe(0);
  expect(validate(json.padEnd(65537)).status).not.toBe(0);
  const malformed = validate('FAKE_SECRET_NOT_JSON');
  expect(malformed.status).not.toBe(0);
  expect(malformed.stderr).not.toContain('FAKE_SECRET');
});
