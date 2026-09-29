import { compileExclusions } from '../../src/adapters/exclusions.ts';

it('escapes literal brackets and backslashes independently without introducing glob operators', () => {
  const excluded = compileExclusions([
    String.raw`vendor\[ab]`,
    String.raw`vendor\x`,
    '[abc]',
    'packages/*/fixture/**',
  ]);
  expect(excluded(String.raw`vendor\x`)).toBe(true);
  expect(excluded('vendorx')).toBe(false);
  expect(excluded(String.raw`vendor\[ab]`)).toBe(true);
  expect(excluded(String.raw`vendor\a`)).toBe(false);
  expect(excluded('[abc]')).toBe(true);
  expect(excluded('a')).toBe(false);
  expect(excluded('packages/one/fixture')).toBe(true);
  expect(excluded('packages/one/other')).toBe(false);
});
