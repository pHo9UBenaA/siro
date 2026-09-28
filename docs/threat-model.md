# Threat model

siro checks local dependency-installation and publication configuration. Its output
helps review supported policy gaps; a clean result is not a security attestation.

## Trusted code and untrusted data

- PM manifests and configuration are read as data. Built-in checks do not install
  dependencies, execute package scripts or edit files.
- `siro.config.ts`, `.mjs`, and `.js` are executable code. The CLI imports cwd's
  config with the caller's permissions, before validating its exported value.
  Custom rules and reporters have the same privileges and can alter results.
- Library `lint` calls do not import repository code. `loadConfig` is an explicit
  opt-in to execution. Child and additional-root executable configs are not loaded.
- Installing siro trusts its distributed code and dependencies. `npx` may download
  code before checking anything. Pin an exact version when repeatability matters.

For unfamiliar repositories or pull requests, use an isolated environment without
credentials and with restricted filesystem/network access. Do not execute repository
config in a privileged `pull_request_target` job. Shape validation is not sandboxing.

## What a scan does not establish

siro does not detect malware, query vulnerability databases, validate every lockfile
resolution or enforce the commands used to install and publish. It does not resolve
user/global configuration, environment variables or inherited workspace policy.
An attacker who can change siro config or CI can disable checks; protect those files
through your repository's review and branch controls.

[Discovery](configuration.md#inspection-scope-packages-and-installation-roots) and
installation-policy inspection differ. Only explicit installation roots receive
installation checks; unlisted independent projects can remain uninspected. Rules may
also be disabled or downgraded. Exit `0` means no findings met the chosen threshold,
not that every input or control is safe.

PM versions are declarations, not measurements of installed binaries. Availability
checks cover only the [listed settings](rules.md#checked-introduction-versions).
See [policy sources](policy-sources.md) for manager-specific limits.

Directory symlinks below cwd are not traversed, but cwd and file symlinks use normal
filesystem resolution. A scan is neither a containment sandbox nor an atomic
filesystem snapshot. Lockfile presence does not prove validity or git tracking.

## Using findings safely

Treat filenames, values and messages as untrusted data. Pretty output and CLI
diagnostics escape display controls; JSON preserves decoded values; GitHub output
escapes annotation fields. API consumers must use encoding appropriate to their own output and must
not assume filenames are portable across operating systems.

Remediation is advisory. Review edits, preserve unrelated content, resolve conflicts
and rerun lint. The word "automatic" describes an operation format, not permission
to write. siro does not apply those operations.

Read/parse errors mean inspection is incomplete. Output failures can leave a partial
report and exit `70`; do not turn them into a successful empty result. Trusted
extensions can bypass built-in reporting or start other work; output protection does
not sandbox them. See [JSON output](json-output.md) for consumer requirements.

## Reporting vulnerabilities

See [SECURITY.md](../SECURITY.md) for private reporting and supported release policy.
