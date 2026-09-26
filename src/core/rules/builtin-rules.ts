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

// Every built-in requires an explicit member decision. This internal policy is
// deliberately separate from the public Rule contract: custom rules stay at root.
const builtinScope = {
  'advisory-check': 'root-only',
  'approved-git-repos': 'root-only',
  'audit-suppression': 'root-only',
  'block-auto-install': 'root-only',
  'block-exotic-subdeps': 'root-only',
  'bun-security-scanner': 'root-only',
  'checksum-verification': 'root-only',
  'commit-lockfile': 'root-only',
  'dependency-overrides': 'root-only',
  'disable-lifecycle-scripts': 'root-only',
  'enforce-strict-ssl': 'root-only',
  'files-field': 'root-and-member',
  'frozen-lockfile': 'root-only',
  'frozen-store': 'root-only',
  'hardened-mode': 'root-only',
  'minimum-release-age': 'root-only',
  'named-registries': 'root-only',
  'paranoid-mode': 'root-only',
  'patched-dependencies': 'root-only',
  'pin-exact-versions': 'root-only',
  provenance: 'root-only',
  'publish-access': 'root-and-member',
  'store-server': 'root-only',
  'strict-allow-scripts': 'root-only',
  'strict-release-age': 'root-only',
  'strict-store-integrity': 'root-only',
  'trust-policy': 'root-only',
  'unsupported-settings': 'root-and-member',
} as const satisfies Record<BuiltinRuleId, 'root-only' | 'root-and-member'>;

export const memberPublicationRuleIds: ReadonlySet<string> = new Set(
  Object.entries(builtinScope)
    .filter(([, scope]) => scope === 'root-and-member')
    .map(([id]) => id),
);
