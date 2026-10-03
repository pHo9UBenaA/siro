import { createCodecFor } from '../../../src/adapters/codecs/store.ts';
import { DEFAULT_SCAN_LIMITS } from '../../../src/core/contracts/scan-limits.ts';

it.each([
  { kind: 'json', first: '{"section":{"enabled":true}}', second: '{"section":{"enabled":false}}' },
  { kind: 'yaml', first: 'section:\n  enabled: true', second: 'section:\n  enabled: false' },
  { kind: 'toml', first: '[section]\nenabled=true', second: '[section]\nenabled=false' },
  { kind: 'npmrc', first: '[section]\nenabled=true', second: '[section]\nenabled=false' },
] as const)('keeps $kind parsing fresh and depth limits independent', ({ kind, first, second }) => {
  const permissive = createCodecFor({ ...DEFAULT_SCAN_LIMITS, maxConfigDepth: 2 });
  const restrictive = createCodecFor({ ...DEFAULT_SCAN_LIMITS, maxConfigDepth: 1 });
  expect(permissive(kind).parse(first)).toEqual({ section: { enabled: true } });
  expect(() => restrictive(kind).parse(first)).toThrow(/maxConfigDepth/);
  expect(permissive(kind).parse(second)).toEqual({ section: { enabled: false } });
});
