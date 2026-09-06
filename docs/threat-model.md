# Threat model

## Purpose and assets

siro identifies local package-manager settings that weaken dependency installation or publication policy. The assets at risk are the invoking machine, its credentials, the repository, and downstream consumers of findings and release artifacts.

## Trust boundaries

| Input or component                 | Trust and behavior                                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package-manager configuration      | Parsed as data. Built-in rules read configuration and emit findings; they do not install dependencies or apply fixes.                                                                                                                                                          |
| `siro.config.ts`, `.mjs`, or `.js` | Executable code, imported before its exported shape is validated. It can read files, access the network, start processes, or mutate the machine with the caller's permissions. Validation is not sandboxing.                                                                   |
| Custom rules and reporters         | Executable, trusted extensions with the same process privileges. They can change results and have effects beyond built-in linting.                                                                                                                                             |
| Filesystem and symlinks            | Files are read through normal filesystem access. The working directory is not a security sandbox, and symlinks are not a containment boundary.                                                                                                                                 |
| Findings and remediation           | Advisory output. An external editor or agent must review operations, preserve unrelated content, handle conflicts, and rerun lint after editing. Automatic remediation does not authorize an edit.                                                                             |
| Package-manager defaults           | Only defaults recorded as safe across every supported version and target environment may lower severity. Installed versions, environment variables, user/global configuration, CI commands, and every workspace member are not resolved into an effective installation policy. |
| Tool installation and updates      | Running siro trusts its distributed code and dependencies. An installer such as `npx` may download code before any linting occurs.                                                                                                                                             |

## Threats addressed and limits

Checks can identify permissive script settings, unpinned dependency ranges, disabled integrity controls, missing release-age policies, and other supported configuration gaps. These controls reduce specific opportunities for compromise; none proves the absence of malicious packages or prevents every supply-chain attack.

siro does not scan package contents, detect malware, verify all lockfile resolutions against the registry, enforce install commands, monitor network traffic, or replace vulnerability scanners. An attacker able to change the siro configuration or CI workflow can disable checks. Protect those files using the repository's own review and branch controls.

Exit code `0` means no findings at or above the chosen threshold under the selected policy; informational findings may still exist. A parse error means the run did not complete successfully. Configured rule exclusions and severity overrides affect the result.

For untrusted repositories or pull requests, run in an isolated environment without credentials and with restricted network/filesystem access. Do not run repository-supplied configuration in a privileged `pull_request_target` job. The library `lint` API accepts explicit configuration and does not import repository code; the CLI always discovers executable configuration.

## Release controls

Repository workflows pin external Actions to full commit SHAs, use read-only repository permissions by default, and avoid persisting checkout credentials. Dependabot proposes Action updates for review. The public publication workflow uses an OIDC-capable job; the registry's trusted-publisher configuration and repository protections remain external administration requirements.

These controls do not prevent compromise by a trusted maintainer, a malicious reviewed change, or a compromised distribution dependency. Public releases ship readable JavaScript, and consumers can pin an exact siro version and inspect the package before use.

## Reporting

See [SECURITY.md](../SECURITY.md). This document describes the current boundaries; it is not a certification or a claim of complete protection.

References: [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use), [versioning policy](configuration.md#versioning-policy), [JSON output](json-output.md).
