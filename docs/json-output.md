# JSON output contract (`--reporter json`)

The json reporter is siro's machine-readable surface, consumed by external
fixers (editor tooling, agent skills). **Contract scope:** this document, the
JSON shape, and the exit codes (docs/configuration.md §Exit codes) are stable
interfaces. Human-readable stderr/stdout prose is NOT a contract — never
parse it.

`schemaVersion` is bumped on any breaking shape change. Consumers must check
it before reading further fields. Embedders that shadow the `json` reporter
name via `reporters: [...]` void this contract — the replacement reporter's
output is not guaranteed to match this specification.

## Document root

| Field           | Type      | Meaning                                       |
| --------------- | --------- | --------------------------------------------- |
| `schemaVersion` | number    | Currently `1`.                                |
| `siroVersion`   | string    | The siro version that produced the document.  |
| `findings`      | Finding[] | Violations at or above the display threshold. |
| `summary`       | object    | `{ error, warn, info }` counts of `findings`. |

## Finding

| Field         | Type                          | Meaning                                                             |
| ------------- | ----------------------------- | ------------------------------------------------------------------- |
| `ruleId`      | string                        | Rule identifier (see docs/rules.md).                                |
| `pm`          | string                        | Package manager the binding evaluated.                              |
| `severity`    | `"error" \| "warn" \| "info"` | Resolved severity.                                                  |
| `message`     | string                        | Human message. Not a contract; do not parse.                        |
| `file`        | string?                       | Repo-relative target file, absent for existence checks.             |
| `fixable`     | boolean                       | True when `fix` contains setKey ops a fixer can apply mechanically. |
| `fix`         | FixOp[]                       | Remediation ops (below). Empty when `manualSteps` is present.       |
| `manualSteps` | string[]?                     | Steps a human/agent must perform; supersedes `fix`.                 |
| `expected`    | scalar?                       | Value the rule requires at the key, when applicable.                |
| `actual`      | any?                          | Value observed at the key (may be `null`, arrays, objects).         |
| `docs`        | string?                       | Official documentation URL.                                         |

## FixOp

One of:

- `{ "op": "setKey", "file": { "kind": "npmrc" | "yaml" | "toml" | "json", "path": "<repo-relative>" }, "keyPath": string[], "value": string | number | boolean }`
  — set the (possibly nested) key to the value, preserving comments and
  unrelated keys in the target file.
- `{ "op": "ensureFileTracked", "file": { "kind": "fileGlob", "path": "<repo-relative>" }, "message": string }`
  — the named file must exist and be committed.
- `{ "op": "note", "message": string, "file"?: { ... } }` — prose-only advice.

## Fixer loop

1. `siro lint --reporter json` → apply `fix` ops / surface `manualSteps`.
2. Re-run `siro lint`; exit code `0` confirms convergence. siro is the
   deterministic verifier — fixers never need to re-implement rule logic.
