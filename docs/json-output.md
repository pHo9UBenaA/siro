# JSON output

`--reporter json` emits one document. Consumers must check `schemaVersion`
before processing it. Human-readable messages are not stable identifiers.
A custom reporter registered as `json` can replace this output.

| Root field      | Meaning                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `schemaVersion` | `2`                                                                            |
| `siroVersion`   | Running package version                                                        |
| `findings`      | Findings at or above the display threshold                                     |
| `summary`       | `{ "error": number, "warn": number, "info": number }` counts of those findings |

Each finding has `ruleId`, `pm`, `severity`, and `message`. Optional fields are
`file` (repository-relative path), `docs` (reference URL), `expected` (string,
finite number, or boolean), `actual` (observed data), and `remediation`.
Undefined fields are omitted. Repository-wide checks may omit `file`.

## Remediation

A remediation has exactly one of these forms:

```json
{
  "kind": "automatic",
  "operations": [
    {
      "op": "setKey",
      "file": { "kind": "npmrc", "path": ".npmrc" },
      "keyPath": ["save-exact"],
      "value": true
    }
  ]
}
```

`operations` is non-empty. Each operation names a configuration file (`npmrc`,
`yaml`, `toml`, or `json`), a non-empty key path, and a scalar replacement value.

```json
{
  "kind": "manual",
  "steps": ["Remove the script-approval bypass before enabling strict approval."]
}
```

`steps` is non-empty. Manual remediation never carries write operations. Built-in proposals also use
manual guidance when a scalar write would discard a settings container or replace
a non-object parent.
A finding without `remediation` makes no proposed change.

siro does not apply changes. An external consumer must review the proposed edit,
preserve unrelated content and comments, resolve conflicts, and rerun lint.
Automatic describes the representation of the remedy, not authorization to edit.
Exit `0` means no finding meets the failure threshold; lower-severity findings
may remain. See [configuration.md](configuration.md#exit-codes).

## Migration from schema 1

The `fix`, `fixable`, and `manualSteps` finding fields were replaced by
`remediation`. `setKey` operations move under `remediation.operations`;
`note` and `ensureFileTracked` messages become manual `steps`. A manual remedy
is chosen by the check itself, so there is no second operation list to suppress.
