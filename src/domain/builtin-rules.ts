import type { BuiltinRuleId } from './entities/rule-id.ts';
import type { Rule } from './entities/rule.ts';
import { advisoryCheck } from './rules/advisory-check.ts';
import { approvedGitRepos } from './rules/approved-git-repos.ts';
import { auditSuppression } from './rules/audit-suppression.ts';
import { blockAutoInstall } from './rules/block-auto-install.ts';
import { blockExoticSubdeps } from './rules/block-exotic-subdeps.ts';
import { bunSecurityScanner } from './rules/bun-security-scanner.ts';
import { checksumVerification } from './rules/checksum-verification.ts';
import { commitLockfile } from './rules/commit-lockfile.ts';
import { dependencyOverrides } from './rules/dependency-overrides.ts';
import { disableLifecycleScripts } from './rules/disable-lifecycle-scripts.ts';
import { enforceStrictSsl } from './rules/enforce-strict-ssl.ts';
import { filesField } from './rules/files-field.ts';
import { frozenLockfile } from './rules/frozen-lockfile.ts';
import { frozenStore } from './rules/frozen-store.ts';
import { hardenedMode } from './rules/hardened-mode.ts';
import { minimumReleaseAge } from './rules/minimum-release-age.ts';
import { namedRegistries } from './rules/named-registries.ts';
import { paranoidMode } from './rules/paranoid-mode.ts';
import { patchedDependencies } from './rules/patched-dependencies.ts';
import { pinExactVersions } from './rules/pin-exact-versions.ts';
import { provenance } from './rules/provenance.ts';
import { publishAccess } from './rules/publish-access.ts';
import { storeServer } from './rules/store-server.ts';
import { strictAllowScripts } from './rules/strict-allow-scripts.ts';
import { strictReleaseAge } from './rules/strict-release-age.ts';
import { strictStoreIntegrity } from './rules/strict-store-integrity.ts';
import { trustPolicy } from './rules/trust-policy.ts';

const RULE_REGISTRY = {
  'advisory-check': advisoryCheck,
  'approved-git-repos': approvedGitRepos,
  'audit-suppression': auditSuppression,
  'block-auto-install': blockAutoInstall,
  'block-exotic-subdeps': blockExoticSubdeps,
  'bun-security-scanner': bunSecurityScanner,
  'checksum-verification': checksumVerification,
  'commit-lockfile': commitLockfile,
  'dependency-overrides': dependencyOverrides,
  'disable-lifecycle-scripts': disableLifecycleScripts,
  'enforce-strict-ssl': enforceStrictSsl,
  'files-field': filesField,
  'frozen-lockfile': frozenLockfile,
  'frozen-store': frozenStore,
  'hardened-mode': hardenedMode,
  'minimum-release-age': minimumReleaseAge,
  'named-registries': namedRegistries,
  'paranoid-mode': paranoidMode,
  'patched-dependencies': patchedDependencies,
  'pin-exact-versions': pinExactVersions,
  provenance,
  'publish-access': publishAccess,
  'store-server': storeServer,
  'strict-allow-scripts': strictAllowScripts,
  'strict-release-age': strictReleaseAge,
  'strict-store-integrity': strictStoreIntegrity,
  'trust-policy': trustPolicy,
} as const satisfies Record<BuiltinRuleId, Rule>;

export const rules: readonly Rule[] = Object.values(RULE_REGISTRY);
