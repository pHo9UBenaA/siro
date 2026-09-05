# Changelog

## [0.3.1]

### Fixes

- Preserve errors from custom rules whose names match inherited object properties when the severity override map is empty.
- Honor explicit severity settings for prototype-named custom rules and reject invalid values with their configuration paths.
- Detect Deno partial and wildcard versions before import subpaths while preserving exact versions.
- Accept positive fractional npm release-age settings parsed from `.npmrc`.
- Run related tests for staged TypeScript files in the pre-commit hook.
- Accept documented Deno minute strings and Yarn duration strings in release-age settings.
- Honor npm script-policy bypass and ignore-scripts precedence; bypass remediation remains manual.
- Treat npm 12's default URL restrictions as safe informational pins and recommend `none` without weakening defaults.
- Stop accepting `npm-shrinkwrap.json` as lockfile protection under the latest npm policy; preserve npm detection from that legacy file.
- Treat Aube frozen-lockfile enforcement as command guidance, not an automatic `preferFrozenLockfile` fix.
- Honor Aube's `paranoid` switch across its six forced security controls; explicitly disabled integrity verification still requires manual remediation.

### Security and documentation

- Pin workflow Actions to verified full commit SHAs, disable persisted checkout credentials, and configure Dependabot Action updates.
- Add security reporting guidance, a threat model, and a concrete before/after example.
- Refresh cited package-manager metadata and clarify static-analysis and OSS benchmark limitations.
- Align Aube frozen-lockfile examples with its unconditional command advisory.

## [0.3.0]

### Features

- **Project policy selection**: `--project-type application|package`, `SiroConfig.projectType`, and `LintOptions.projectType` distinguish dependency-consuming applications from published packages. Omit the selection to infer policy per package-manager binding.
- **Scoped custom rules**: `Rule.projectTypes` follows explicit or inferred policy for npm-family and Deno bindings.

### Fixes

- Programmatic `lintCommand` calls reject unsupported project type, package manager, and severity values instead of returning misleading results.
- Malformed custom rules from config files or untyped programmatic callers are rejected before rule merging and evaluation.
- Empty and whitespace-only package names no longer activate published-package policy.
- Unscoped Deno rules no longer read `deno.json` solely for project-type inference.
- The published `package.json#bin` preserves exit code 70 when a reporter or custom rule crashes, and subprocess tests now execute that declared bin directly.
- Malformed or cyclic YAML configurations are rejected, while TOML configurations with a leading UTF-8 BOM are accepted.
- Deno release-age validation accepts documented default forms and rejects invalid, partial, or zero ages.
- Repeated reporter selectors and non-boolean Yarn strict SSL values are rejected as invalid input.
- Findings without automatic remediation operations no longer report themselves as fixable.

## [0.2.0]

### Breaking Changes

- **Node.js `^22.18.0 || ^23.6.0 || >=24.0.0` required** (was `>=20`): `siro.config.ts` now loads via Node's native type stripping.

### Features

- **OSS benchmarks module**: coverage validation against 47 leading OSS projects across all 6 package managers. Includes sparse-checkout clone script, snapshot-based CI mode, and local clone-based checking.
- **jiti dependency removed**: runtime dependencies drop from 7 to 6. `.ts` configs load via native type stripping, and every `loadConfig` call now truly re-reads the config from disk (jiti's transform cache could replay a same-second rewrite).
- **Unminified dist**: the published bundle ships as readable JavaScript for supply-chain transparency.

### Fixes

- A `.ts` config on a runtime without type stripping fails with an actionable `ConfigError` instead of a raw `ERR_UNKNOWN_FILE_EXTENSION`.
- `pnpm gen:rule` works again — the scaffolder's marker had drifted from `rule-id.ts`.

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
