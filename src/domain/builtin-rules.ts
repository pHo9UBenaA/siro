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

export const rules = [
  advisoryCheck,
  approvedGitRepos,
  auditSuppression,
  blockAutoInstall,
  blockExoticSubdeps,
  bunSecurityScanner,
  checksumVerification,
  commitLockfile,
  dependencyOverrides,
  disableLifecycleScripts,
  enforceStrictSsl,
  filesField,
  frozenLockfile,
  frozenStore,
  hardenedMode,
  minimumReleaseAge,
  namedRegistries,
  paranoidMode,
  patchedDependencies,
  pinExactVersions,
  provenance,
  publishAccess,
  storeServer,
  strictAllowScripts,
  strictReleaseAge,
  strictStoreIntegrity,
  trustPolicy,
] as const satisfies readonly Rule[];

export type BuiltinRuleId = (typeof rules)[number]['id'];
