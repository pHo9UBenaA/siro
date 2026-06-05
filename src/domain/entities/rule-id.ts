/**
 * Closed set of built-in rule IDs. Declared in `domain/` so SiroConfig can
 * type `rules` keys without depending on the engine.
 */
const BUILTIN_RULE_IDS = [
  'advisory-check',
  'approved-git-repos',
  'audit-suppression',
  'block-auto-install',
  'block-exotic-subdeps',
  'bun-security-scanner',
  'checksum-verification',
  'commit-lockfile',
  'dependency-overrides',
  'disable-lifecycle-scripts',
  'enforce-strict-ssl',
  'files-field',
  'frozen-lockfile',
  'frozen-store',
  'hardened-mode',
  'minimum-release-age',
  'named-registries',
  'paranoid-mode',
  'patched-dependencies',
  'pin-exact-versions',
  'provenance',
  'publish-access',
  'store-server',
  'strict-allow-scripts',
  'strict-release-age',
  'strict-store-integrity',
  'trust-policy',
] as const;

export type BuiltinRuleId = (typeof BUILTIN_RULE_IDS)[number];
