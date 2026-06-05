# Changelog

## [0.1.3]

Initial public release. 27 rules across 6 package managers (npm, pnpm, yarn, bun, deno, aube).

### Features

- **27 security rules** covering lifecycle scripts, version pinning, lockfiles (`commit`/`frozen`), release age, publish provenance, `files`/`publishConfig`, SSL enforcement, checksum verification, exotic subdependency blocking, audit suppression review, store integrity, and Bun's security scanner API.
- **6 package managers**: npm, pnpm, yarn, bun, deno, aube — auto-detected from `packageManager` field, lockfiles, and config files.
- **PM-aware severities**: findings demoted to `info` when the PM's documented default already satisfies the rule.
- **Machine-readable JSON output** with `fix` operations and `manualSteps` for automated remediation.
- **Reporters**: `pretty` (default), `json` (CI), `github` (PR annotations); extensible via custom reporters.
- **Configuration file** (`siro.config.ts`): disable rules, override severities, restrict PMs, plug in custom rules and reporters.
- **`--severity` flag**: gate CI on `error` (default) or `warn` for stricter checks.
- **`--pm` flag**: target a specific package manager.
- **`--json` flag**: shortcut for `--reporter json`.

### Rules added

- `advisory-check` — aube `security.advisoryCheck`
- `approved-git-repos` — yarn `npmScopes.*.approvedGitRepos`
- `audit-suppression` — yarn `npmAuditExclude`
- `block-auto-install` — pnpm `autoInstallPeers`, aube `peerDependencies.autoInstall`
- `block-exotic-subdeps` — aube `blockExoticSubdeps`
- `bun-security-scanner` — bun `install.security`
- `checksum-verification` — pnpm `verifyStoreIntegrity`, aube `checksumVerification`
- `commit-lockfile` — npm `lockfileVersion` (lockfile committed to git)
- `dependency-overrides` — pnpm `pnpm.overrides`, aube `overrides`
- `disable-lifecycle-scripts` — npm `ignore-scripts`, pnpm `strictDepBuilds`, yarn `enableScripts`, bun `install.ignoreScripts`, deno `deno.json#/tasks`, aube `jailBuilds`
- `enforce-strict-ssl` — npm/yarn/pnpm/bun/aube `strict-ssl`
- `files-field` — npm `files` in package.json
- `frozen-lockfile` — npm `ci` enforcement, pnpm `frozen-lockfile`, yarn `freezeLockfile`, aube `preferFrozenLockfile`
- `frozen-store` — pnpm `store.frozen`
- `hardened-mode` — yarn `enableHardenedMode`
- `minimum-release-age` — pnpm `fetchRetries`, aube `minimumReleaseAge`
- `named-registries` — pnpm `registries.*.registry`
- `paranoid-mode` — aube `paranoid`
- `patched-dependencies` — pnpm `patchedDependencies`
- `pin-exact-versions` — npm `save-exact`, pnpm `save-exact`, deno `deno.json#/imports`
- `provenance` — npm/pnpm `publishConfig.provenance`
- `publish-access` — npm/pnpm `publishConfig.access`
- `publishable` — package.json `private`
- `store-server` — pnpm `store.server`
- `strict-allow-scripts` — aube `strictAllowScripts`
- `strict-release-age` — aube `strictReleaseAge`
- `strict-store-integrity` — pnpm `store.integrity`
- `trust-policy` — aube `trustPolicy`

### Tooling

- CI via GitHub Actions (Node 20, 22, 24 matrix)
- Pre-commit hooks: lint (oxlint), format (oxfmt), typecheck, related tests
- Pre-push hooks: full lint, typecheck, test coverage
- Commit message linting via commitlint (conventional commits)
- Dead code detection via knip
- Rule scaffold generator (`pnpm gen:rule`)
- Documentation generators (`pnpm gen:rules`, `pnpm gen:comparison`)
- Version module auto-generation from package.json
- Layering enforcement script
