# JSON output

`--reporter json` emits exactly one document. Check `schemaVersion` before
processing it. Messages are not stable identifiers. A registered custom `json`
reporter may replace this contract. Await direct reporter calls and supply their scan
context: `await jsonReporter.format(result, io, { cwd })`.

Parse JSON rather than comparing serialized bytes. Command-like sequences such as
`##[` and display-control characters can use Unicode escapes; decoded values and
schemaVersion 3 remain unchanged. No workflow-command wrapper lines surround JSON.

| Root field      | Meaning                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| `schemaVersion` | `3` (independent of package version 0.6.0)                                             |
| `siroVersion`   | Running package version                                                                |
| `findings`      | Display-filtered findings                                                              |
| `summary`       | `{ "error": number, "warn": number, "info": number }` finding counts                   |
| `inspection`    | Selected manifests and explicit installation targets, unaffected by severity filtering |

```json
{
  "schemaVersion": 3,
  "siroVersion": "0.6.0",
  "findings": [
    {
      "ruleId": "files-field",
      "directory": "tools/standalone",
      "file": "tools/standalone/package.json",
      "severity": "info",
      "message": "Add a files allow-list."
    }
  ],
  "summary": { "error": 0, "warn": 0, "info": 1 },
  "inspection": {
    "manifests": [
      {
        "path": "package.json",
        "projectType": "application",
        "targets": [{ "pm": "pnpm", "version": "11.7.0" }]
      },
      { "path": "tools/standalone/package.json", "projectType": "package", "targets": [] }
    ],
    "installationRoots": [{ "directory": ".", "targets": [{ "pm": "pnpm", "version": "11.7.0" }] }]
  }
}
```

This example discovered a package but did **not** inspect its installation policy.
`targets: []` means PM unknown; a target without `version` means version unknown.
Availability is not assessed for unknown versions. Inspection is an input-scope
record, not proof that all controls ran or passed (rules may be off). A declaration
is not attestation of an executed PM binary.

Each finding requires `ruleId`, `directory`, `severity`, `message`. `directory` is
cwd-relative; root is `.`. `pm` is optional and absent for generic publication
checks. Optional fields also include `file`, `docs`, scalar `expected`, observed
`actual`, and `remediation`. Undefined fields are omitted. File-less checks do not
acquire a synthetic package.json. Multiple findings may share a rule ID.

## Paths and remediation

These API/JSON paths differ from GitHub annotation properties: the GitHub reporter
uses its explicit scan cwd to emit absolute file references. The runner can then
associate them with the correct workspace file even when scanning a subdirectory.

All output `file` and `operations[].file.path` values are cwd-relative, not relative
to `directory`. Consumers must **not prefix directory again**. Native component
spelling is preserved: POSIX `scratch\notes` differs from `scratch/notes`. JSON
escapes a literal backslash normally. `/` joins components. These paths are not a
cross-OS filename conversion or a filesystem containment sandbox.

```json
{
  "kind": "automatic",
  "operations": [
    {
      "op": "setKey",
      "file": { "kind": "npmrc", "path": "tools/standalone/.npmrc" },
      "keyPath": ["save-exact"],
      "value": true
    }
  ]
}
```

Operations are a nonempty ordered list. File kinds are `npmrc`, `yaml`, `toml`,
`json`; key paths are nonempty; values are strings, finite numbers or booleans.
All operation paths in a multi-file remedy are rebased immutably once, after local
availability guards. Unrelated keys and rule-owned output objects are preserved.

```json
{
  "kind": "manual",
  "steps": ["Work in tools/standalone for this finding.", "Review installation settings."]
}
```

Manual steps are nonempty and carry no operations. Non-object parent/container
replacement or a known unsupported target can require manual guidance. A missing
remediation proposes no change. siro **does not apply edits**. External consumers
must review changes, preserve unrelated content/comments, resolve conflicts and
rerun lint. Automatic describes a representation, not permission to write.

For pairs in the [availability table](rules.md#checked-introduction-versions),
a known too-old target makes the whole operation group manual upgrade guidance;
no partial automatic group is emitted. Unknown targets/unlisted settings retain
their usual remedies without a general support guarantee.

## Migration

From schema 2: require `directory` and `inspection`, accept absent `pm`, and use
cwd-relative operation paths. Generic checks are no longer duplicated across PMs.
Severity filtering must not discard inspection. Replace PM workspace selection
with [common discovery and explicit installation roots](configuration.md).

From schema 1: `fix`, `fixable`, `manualSteps` became `remediation`; setKey moved
under operations, and note/ensureFileTracked became manual steps.

Exit 0 only means no finding meets the configured failure threshold. Exit 2 means
inspection did not complete; do not synthesize a successful empty report. Unexpected
reporter/custom-rule exceptions exit 70, even after partial output.
