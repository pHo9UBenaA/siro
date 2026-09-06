import { asAbsPath, asRelPath } from '../../src/shared/paths.ts';

it.each(['', 'relative/repo'])('rejects a non-absolute repository root: %j', (value) => {
  expect(() => asAbsPath(value)).toThrow(/absolute/u);
});

it.each([
  '',
  '/outside',
  '../outside',
  'nested/../../outside',
  'C:\\outside',
  '\\outside',
  'nul\0path',
])('rejects a path outside the repository-relative contract: %j', (value) => {
  expect(() => asRelPath(value)).toThrow(/relative/u);
});

it('accepts nested repository paths and native absolute roots', () => {
  expect(asAbsPath(process.cwd())).toBe(process.cwd());
  expect(asRelPath('config/project.yaml')).toBe('config/project.yaml');
});
