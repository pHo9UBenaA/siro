import * as vb from 'valibot';
import { type AbsPath, asAbsPath } from '../shared/paths.ts';
import { PMS, SEVERITIES } from '../domain/entities/pms.ts';
import { type Reporter, isReporterShape } from '../domain/ports/reporter.ts';
import { ConfigError } from '../shared/errors.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import type { Rule } from '../domain/entities/rule.ts';
import type { SiroConfig } from '../domain/entities/siro-config.ts';
import { rules as builtinRules } from '../domain/builtin-rules.ts';
import { createJiti } from 'jiti';
import { nodeFileSystem } from './node-file-system.ts';
import path from 'node:path';
import { validateRuleIds } from '../domain/services/validate-rule-ids.ts';

// Array order IS the precedence: if more than one exists, the first match
// wins and the rest are ignored. This is deliberate (a single deterministic
// pick) rather than an error — loadConfig has no IO channel to warn on, and a
// repo with two siro.config.* files is already a self-inflicted oddity.
const MIN_PMS_LENGTH = 1;
const CONFIG_NAMES = ['siro.config.ts', 'siro.config.mjs', 'siro.config.js'] as const;

// Rule / Reporter hold user-supplied functions, so no runtime schema can
// actually validate them — the contract is enforced at compile time by
// `defineConfig`. `v.unknown()` would express that pass-through but erase
// the inferred type and force every caller to cast; `vb.custom<T>(() => true)`
// keeps the type without pretending to validate.
// strictObject (not loose): an unknown top-level key is almost always a typo
// (`rule` for `rules`, `customRule` for `customRules`) that a loose schema
// would silently drop. siro fails fast on rule-id typos, so key typos fail
// fast too. defineConfig already enforces the shape at compile time; this is
// the runtime guard for hand-written / JS configs.
const ConfigSchema = vb.strictObject(
  {
    customRules: vb.optional(vb.array(vb.custom<Rule>(() => true))),
    pms: vb.optional(
      vb.pipe(
        vb.array(vb.picklist(PMS)),
        // An empty list would reach resolvePMs and render a broken usage
        // message ("restricts pms to ."); the mistake is in the config, so
        // name it at load time instead.
        vb.minLength(
          MIN_PMS_LENGTH,
          'must not be empty (omit the key to auto-detect, or list at least one PM)',
        ),
      ),
    ),
    // Validate reporter SHAPE (name + format) even though the Rule/Reporter
    // contracts are otherwise compile-time only: a malformed reporter from a
    // hand-written config would otherwise crash at format-call time with a
    // bare TypeError instead of a ConfigError naming the file.
    reporters: vb.optional(
      vb.array(vb.custom<Reporter>(isReporterShape, 'must be a { name, format } reporter')),
    ),
    rules: vb.optional(
      vb.record(vb.string(), vb.union([vb.picklist(SEVERITIES), vb.literal('off')])),
    ),
  },
  'unknown config key (check for a typo)',
);

const describeError = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
};

const formatIssues = (
  issues: readonly { path?: readonly { key?: unknown }[]; message: string }[],
): string =>
  issues
    .map((issue) => {
      const keyPath = (issue.path ?? [])
        .map((seg) => seg.key)
        .filter((key): key is string | number => typeof key === 'string' || typeof key === 'number')
        .join('.');
      if (keyPath) {
        return `${keyPath}: ${issue.message}`;
      }
      return issue.message;
    })
    .join('; ');

/**
 * Locate and load `siro.config.{ts,mjs,js}` under `cwd`. Returns undefined when
 * no config exists. Throws ConfigError on malformed exports.
 */
const importConfig = (
  jitiInst: ReturnType<typeof createJiti>,
  modulePath: string,
  name: string,
): Promise<unknown> =>
  jitiInst.import(modulePath).catch((error: unknown) => {
    throw new ConfigError(`Failed to load ${name}: ${describeError(error)}`);
  });

const extractDefault = (mod: unknown): unknown => {
  if (mod !== null && typeof mod === 'object' && 'default' in mod) {
    const record: Record<string, unknown> = mod;
    return record.default;
  }
  return mod;
};

const validateCandidateShape = (candidate: unknown, name: string): object => {
  // Arrays are `typeof === 'object'`, so the bare check lets `export default
  // []` through to strictObject — where an empty array reads as a valid empty
  // config and a non-empty one surfaces a misleading "unknown config key".
  if (
    typeof candidate === 'undefined' ||
    candidate === null ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    let got: string = typeof candidate;
    if (Array.isArray(candidate)) {
      got = 'an array';
    }
    throw new ConfigError(`${name} must export a config object (got ${got}).`);
  }
  return candidate;
};

const validateSchema = (candidate: object, name: string): SiroConfig => {
  const result = vb.safeParse(ConfigSchema, candidate);
  if (!result.success) {
    throw new ConfigError(`${name}: ${formatIssues(result.issues)}`);
  }
  return result.output;
};

const rejectDuplicateCustomRuleIds = (config: SiroConfig, name: string): void => {
  // Reject customRule ids that shadow a builtin OR repeat within the same
  // customRules array — a colliding id leaves the user's intent ambiguous
  // (override? duplicate? parallel rule?) and `applyConfig` would process
  // both copies. Mirrors `mergeProgrammaticRules` for the programmatic side.
  //
  // The `unknown rule id in rules` check is deliberately NOT run here:
  // the embedder may pass programmatic customRules to lintCommand
  // whose ids legitimately appear in the user's `rules` map.
  // The application layer re-runs validateRuleIds with the programmatic
  // ids in `extraKnownIds` so the full known set is consulted.
  const EMPTY = 0;
  const SINGLE = 1;
  const { duplicates } = validateRuleIds(config, builtinRules);
  if (duplicates.length > EMPTY) {
    let plural = '';
    if (duplicates.length > SINGLE) {
      plural = 's';
    }
    throw new ConfigError(
      `${name}: duplicate customRule id${plural}: ${duplicates.map((id: string) => `'${id}'`).join(', ')}. Pick a unique id (or use 'rules' to override an existing rule's severity).`,
    );
  }
};

const parseCandidate = (
  jiti: ReturnType<typeof createJiti>,
  configPath: AbsPath,
  name: string,
): Promise<SiroConfig> =>
  // `cwd` is already an `AbsPath`, branded at the CLI boundary in
  // `src/cli.ts` via `asAbsPath(resolve(positionalCwd ?? process.cwd()))`.
  // The brand certifies "already resolved", so re-resolving here
  // would only signal that we don't trust our own type contract.
  importConfig(jiti, configPath, name).then((mod) => {
    const candidate = validateCandidateShape(extractDefault(mod), name);
    const config = validateSchema(candidate, name);
    rejectDuplicateCustomRuleIds(config, name);
    return config;
  });

export const loadConfig = (
  cwd: AbsPath,
  fs: FileSystem = nodeFileSystem,
): Promise<SiroConfig | undefined> => {
  // Eagerly created so the candidate loop doesn't pay for a discarded jiti
  // instance per probe. `moduleCache: false` still guarantees the loaded
  // config sees fresh module state on every loadConfig call.
  const jiti = createJiti(cwd, { moduleCache: false });
  const candidate = CONFIG_NAMES.find((name) => fs.exists(asAbsPath(path.join(cwd, name))));
  if (typeof candidate === 'undefined') {
    return Promise.resolve(void 0);
  }
  return parseCandidate(jiti, asAbsPath(path.join(cwd, candidate)), candidate);
};
