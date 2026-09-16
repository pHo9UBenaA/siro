import { minimatchGlobs } from '../../src/adapters/workspace-globs.ts';
import type { WorkspaceGlobOptions } from '../../src/application/ports/workspace-glob.ts';
import { ConfigError } from '../../src/shared/errors.ts';

const shell = {
  kind: 'directory',
  syntax: 'shell',
  caseInsensitive: false,
} as const satisfies WorkspaceGlobOptions;
const wildcards = { ...shell, syntax: 'wildcards' } as const;

it('keeps wildcard punctuation literal while shell patterns expand classes and braces', () => {
  const literal = minimatchGlobs.compile('packages/[ab]{one,two}/*', wildcards);
  expect(literal.matches('packages/[ab]{one,two}/api')).toBe(true);
  expect(literal.matches('packages/aone/api')).toBe(false);
  expect(literal.canDescend('packages/[ab]{one,two}')).toBe(true);
  expect(literal.canDescend('packages/aone')).toBe(false);
  const expanded = minimatchGlobs.compile('packages/[ab]{one,two}/*', shell);
  expect(expanded.matches('packages/aone/api')).toBe(true);
  expect(expanded.matches('packages/[ab]{one,two}/api')).toBe(false);
});

it('distinguishes declaration matching from directory traversal semantics', () => {
  const declaration = { kind: 'declaration' } as const;
  expect(minimatchGlobs.compile('!api', declaration).matches('web')).toBe(true);
  expect(minimatchGlobs.compile('!api', declaration).matches('api')).toBe(false);
  expect(minimatchGlobs.compile('!api', shell).matches('!api')).toBe(true);
  expect(minimatchGlobs.compile('#api', declaration).matches('#api')).toBe(false);
  expect(minimatchGlobs.compile('#api', shell).matches('#api')).toBe(true);
  expect(minimatchGlobs.compile('#api', { ...shell, hashComments: true }).matches('#api')).toBe(
    false,
  );
});

it('honors case, hidden directories and extended-pattern policy independently', () => {
  expect(minimatchGlobs.compile('packages/*', shell).matches('PACKAGES/api')).toBe(false);
  expect(
    minimatchGlobs
      .compile('packages/*', { ...shell, caseInsensitive: true })
      .matches('PACKAGES/api'),
  ).toBe(true);
  expect(minimatchGlobs.compile('packages/*', wildcards).matches('packages/.api')).toBe(false);
  expect(
    minimatchGlobs
      .compile('packages/*', { ...wildcards, includeDotDirectories: true })
      .matches('packages/.api'),
  ).toBe(true);
  expect(minimatchGlobs.compile('packages/@(api|web)', shell).matches('packages/api')).toBe(true);
  const noExtendedPatterns = minimatchGlobs.compile('packages/@(api|web)', {
    ...shell,
    extendedPatterns: false,
  });
  expect(noExtendedPatterns.matches('packages/api')).toBe(false);
  expect(noExtendedPatterns.matches('packages/@(api|web)')).toBe(true);
});

it('prunes completed fixed-depth patterns but continues recursive traversal', () => {
  const fixed = minimatchGlobs.compile('packages/*', shell);
  expect(fixed.canDescend('packages')).toBe(true);
  expect(fixed.canDescend('packages/api')).toBe(false);
  expect(fixed.canDescend('unrelated')).toBe(false);
  const recursive = minimatchGlobs.compile('packages/**', shell);
  expect(recursive.canDescend('packages/api/nested')).toBe(true);
});

it('bounds expansion at the adapter and preserves literal braces in wildcard syntax', () => {
  expect(minimatchGlobs.expand('packages/{api,web}')).toEqual(['packages/api', 'packages/web']);
  expect(() => minimatchGlobs.expand('{1..8193}')).toThrow(ConfigError);
  expect(() => minimatchGlobs.compile('{1..8193}', shell)).toThrow(ConfigError);
  expect(minimatchGlobs.compile('{1..8193}', wildcards).matches('{1..8193}')).toBe(true);
});
