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
  'advisory-check': 'root',
  'approved-git-repos': 'root',
  'audit-suppression': 'root',
  'block-auto-install': 'root',
  'block-exotic-subdeps': 'root',
  'bun-security-scanner': 'root',
  'checksum-verification': 'root',
  'commit-lockfile': 'root',
  'dependency-overrides': 'root',
  'disable-lifecycle-scripts': 'root',
  'enforce-strict-ssl': 'root',
  'files-field': 'member',
  'frozen-lockfile': 'root',
  'frozen-store': 'root',
  'hardened-mode': 'root',
  'minimum-release-age': 'root',
  'named-registries': 'root',
  'paranoid-mode': 'root',
  'patched-dependencies': 'root',
  'pin-exact-versions': 'root',
  provenance: 'root',
  'publish-access': 'member',
  'store-server': 'root',
  'strict-allow-scripts': 'root',
  'strict-release-age': 'root',
  'strict-store-integrity': 'root',
  'trust-policy': 'root',
  'unsupported-settings': 'member',
} as const satisfies Record<BuiltinRuleId, 'root' | 'member'>;

export const memberPublicationRuleIds: ReadonlySet<string> = new Set(
  Object.entries(builtinScope)
    .filter(([, scope]) => scope === 'member')
    .map(([id]) => id),
);
