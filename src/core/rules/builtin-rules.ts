import type { DateTime } from '../contracts/date-time.ts';
import type { Rule } from '../contracts/rule.ts';
import { advisoryCheck } from './advisory-check.ts';
import { approvedGitRepos } from './approved-git-repos.ts';
import { auditSuppression } from './audit-suppression.ts';
import { blockAutoInstall } from './block-auto-install.ts';
import { blockExoticSubdeps } from './block-exotic-subdeps.ts';
import { bunSecurityScanner } from './bun-security-scanner.ts';
import { checksumVerification } from './checksum-verification.ts';
import { commitLockfile } from './commit-lockfile.ts';
import { dependencyOverrides } from './dependency-overrides.ts';
import { disableLifecycleScripts } from './disable-lifecycle-scripts.ts';
import { enforceStrictSsl } from './enforce-strict-ssl.ts';
import { filesField } from './files-field.ts';
import { frozenLockfile } from './frozen-lockfile.ts';
import { frozenStore } from './frozen-store.ts';
import { hardenedMode } from './hardened-mode.ts';
import { createMinimumReleaseAge } from './minimum-release-age.ts';
import { namedRegistries } from './named-registries.ts';
import { paranoidMode } from './paranoid-mode.ts';
import { patchedDependencies } from './patched-dependencies.ts';
import { pinExactVersions } from './pin-exact-versions.ts';
import { provenance } from './provenance.ts';
import { publishAccess } from './publish-access.ts';
import { storeServer } from './store-server.ts';
import { strictAllowScripts } from './strict-allow-scripts.ts';
import { strictReleaseAge } from './strict-release-age.ts';
import { strictStoreIntegrity } from './strict-store-integrity.ts';
import { trustPolicy } from './trust-policy.ts';
import { unsupportedSettings } from './unsupported-settings.ts';

export const createBuiltinRules = (time: DateTime) =>
  [
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
    createMinimumReleaseAge(time),
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
    unsupportedSettings,
  ] as const satisfies readonly Rule[];

export type BuiltinRuleId = ReturnType<typeof createBuiltinRules>[number]['id'];
