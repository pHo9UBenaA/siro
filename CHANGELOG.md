# Changelog

## [0.4.0]

### Breaking Changes

- **One remediation per check**: replace binding `fix`/`fixKind` and finding `fix`/`fixable`/`manualSteps` with `remediation`, containing either automatic operations or manual steps. JSON output uses schema 2.
- **Explicit library configuration**: `lint` returns results without executing repository configuration. Pass extensions inside `config`; use `loadConfig` to opt into trusted file execution. `LintCommandOptions` adds reporting options to `LintOptions`.
- **Validated extension boundaries**: parsed values and `getByPath()` results are `unknown`. Configuration maps, rules, bindings, and reporters require ordinary or null-prototype objects. Path constructors reject invalid roots and repository paths with parent traversal.
- **Simpler rule bindings**: remove `fileGlob`, separate writable-reference and automatic/advisory binding types, `requireConfigKey.extraFix`, and `KeyAssignment`. Repository checks omit `file`; multi-setting policies use direct bindings.
- **Focused public entry**: remove internal codec, detection, registry, filtering, and rendering helpers from package exports. Use `lint`, `lintCommand`, and the documented extension contracts.

### Fixes

- Align npm 12 script-policy precedence, URL restrictions, release-age values, and lockfile guidance with the recorded upstream policy.
- Honor Aube's forced `paranoid` controls while keeping explicitly disabled integrity verification and frozen-lockfile commands as manual guidance.
- Correct npm exact-save precedence, recognize pnpm equality prefixes and Aube `.npmrc` aliases, and reject conflicting Aube prefix settings.
- Require exact versions for Deno registry imports, including tags, omitted versions, partial versions, and subpaths, using the standard semver parser.
- Accept documented Deno and Yarn release-age forms; reject non-finite ages, malformed exclusion lists, and blank scanner names. Preserve Deno age exclusions when proposing a correction.
- Require HTTP exception removal alongside Yarn TLS restoration. Avoid automatic writes that discard settings containers or replace non-object parents.
- Reject non-mapping JSON/YAML roots, empty JSON files, malformed extension results, and missing or non-directory CLI targets with actionable errors.
- Preserve severity overrides for prototype-named custom rules, reject non-record rule settings, and bypass detection for an explicit `--pm` selection.
- Consolidate CLI argument parsing while preserving injected output and exit codes. Run related tests for staged TypeScript files in the pre-commit hook.
- Limit frozen-store guidance to pre-populated read-only deployments and correct patch-integrity and strict release-age explanations.
- Validate native library targets as well as CLI targets; compute the exit decision before custom reporters run.
- Emit Aube install-command guidance without parsing unrelated workspace settings.
- Reject incomplete benchmark runs and invalid OSS snapshots, including duplicate entries and inconsistent project counts.

### Refactoring

- Return remediation from the same check that finds a violation, centralize configuration and rule-ID validation, and bind each parsed-file cache to one repository.
- Replace custom script loading, rule scaffolding and rollback, and layer-whitelist tooling with native Node scripts and ordinary verification commands.
- Read version metadata from the package manifest, generate rule documentation with one script, and check generated documents and unused code in CI.
- Replace syntax and size restrictions with correctness-focused linting; document the runtime responsibilities, migration path, and verification limits.
- Consolidate test timeouts and remove numeric aliases, single-use wrappers, and JSON round trips used to bypass types.
- Run the complete verification command before pushing or publishing, including a fresh build for executable tests.

### Security and documentation

- Pin workflow Actions to full commit SHAs, disable persisted checkout credentials, and configure Dependabot Action updates.
- Add security reporting guidance, a threat model, and a before/after example; clarify static-analysis and OSS benchmark limitations.
- Refresh cited package-manager metadata and align Aube frozen-lockfile examples with its command advisory.

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
