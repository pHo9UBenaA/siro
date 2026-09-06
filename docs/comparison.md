<!-- AUTO-GENERATED from the rule registry. Run `pnpm gen:docs` to update. -->
# Package manager comparison

Which security rules `siro` can check for each package manager.
**✅** = a check is implemented · **—** = no check is implemented.
An absent check says nothing about the manager's capabilities. See the
[rule reference](rules.md) for primary inputs, severity overrides, and version notes.

| Rule | Severity | npm | pnpm | yarn | bun | deno | aube |
| --- | --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `advisory-check` | warn | — | — | — | — | — | ✅ |
| `approved-git-repos` | warn | — | — | ✅ | — | — | — |
| `audit-suppression` | info | — | — | ✅ | — | — | — |
| `block-auto-install` | warn | — | — | — | ✅ | — | — |
| `block-exotic-subdeps` | warn | ✅ | ✅ | — | — | — | ✅ |
| `bun-security-scanner` | info | — | — | — | ✅ | — | — |
| `checksum-verification` | warn | — | — | ✅ | — | — | — |
| `commit-lockfile` | error | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `dependency-overrides` | info | — | ✅ | — | — | — | ✅ |
| `disable-lifecycle-scripts` | error | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `enforce-strict-ssl` | warn | ✅ | — | ✅ | — | — | — |
| `files-field` | info | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `frozen-lockfile` | warn | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `frozen-store` | info | — | ✅ | — | — | — | — |
| `hardened-mode` | warn | — | — | ✅ | — | — | — |
| `minimum-release-age` | warn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `named-registries` | info | — | ✅ | — | — | — | — |
| `paranoid-mode` | info | — | — | — | — | — | ✅ |
| `patched-dependencies` | info | — | ✅ | — | — | — | — |
| `pin-exact-versions` | error | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `provenance` | warn | ✅ | ✅ | ✅ | ✅ | — | — |
| `publish-access` | info | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `store-server` | info | — | ✅ | — | — | — | — |
| `strict-allow-scripts` | warn | ✅ | — | — | — | — | — |
| `strict-release-age` | info | — | — | — | — | — | ✅ |
| `strict-store-integrity` | warn | — | — | — | — | — | ✅ |
| `trust-policy` | warn | — | ✅ | — | — | — | ✅ |
