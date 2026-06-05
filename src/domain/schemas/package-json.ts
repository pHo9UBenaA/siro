import * as vb from 'valibot';

/**
 * Subset of `package.json` that siro actually reads. We keep the schema
 * intentionally narrow — every field rules consume is here, everything else
 * passes through unvalidated under `[key: string]: unknown` semantics.
 *
 * Every field is wrapped in `v.fallback` so one type-mismatched field can't
 * blank out the entire typed view (and silently N/A every publish rule).
 * A malformed value reads as "absent" — EXCEPT `private`, which falls back to
 * `true`: a security tool must never flip a broken `private` into publishable.
 */
const [ABSENT]: undefined[] = [];
const optionalString = vb.fallback(vb.optional(vb.string()), ABSENT);
const PackageJsonSchema = vb.looseObject({
  files: vb.fallback(vb.optional(vb.array(vb.string())), ABSENT),
  name: optionalString,
  packageManager: optionalString,
  // optional-OUTSIDE-fallback: an absent key stays undefined (publishable),
  // while a present non-boolean falls back to `true` (not publishable). The
  // reverse nesting would fall back to `true` even when the key is absent.
  private: vb.optional(vb.fallback(vb.boolean(), true)),
  // `access` is narrowed to the two npm-spec values; anything else (including
  // non-strings) falls back to `undefined` so the whole package.json still
  // parses and other rules keep running.
  publishConfig: vb.fallback(
    vb.optional(
      vb.looseObject({
        access: vb.fallback(
          vb.optional(vb.union([vb.literal('public'), vb.literal('restricted')])),
          ABSENT,
        ),
      }),
    ),
    ABSENT,
  ),
  // Read by disable-lifecycle-scripts × bun: an explicit empty allow-list
  // (`"trustedDependencies": []`) is the package.json-side opt-out equivalent
  // to bunfig `install.ignoreScripts = true`.
  trustedDependencies: vb.fallback(vb.optional(vb.array(vb.string())), ABSENT),
});

export type PackageJson = vb.InferOutput<typeof PackageJsonSchema>;

export const safeParsePackageJson = (value: unknown): PackageJson | undefined => {
  const result = vb.safeParse(PackageJsonSchema, value);
  if (result.success) {
    return result.output;
  }
  return void 0;
};
