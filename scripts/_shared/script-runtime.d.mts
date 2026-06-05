// Type-only sidecar for script-runtime.mjs. The driver scripts are .mjs
// so they can import the helper without a jiti bootstrap (chicken-and-egg
// with the helper that constructs jiti), but the test surface and TS-aware
// editors still want types — hence this declaration file.
//
// Drivers may live at any depth under `scripts/` (top-level or nested
// per-context dirs like `scripts/gen/`, `scripts/review/`). See the
// implementation file for how root and name are derived from the path.

export interface ScriptContextDeps {
  exit?: (code: number) => never;
  errStream?: { write: (chunk: string) => unknown };
  outStream?: { write: (chunk: string) => unknown };
  /**
   * Read by `fail()` to gate the verbose stack-trace path behind
   * `SIRO_DEBUG=1`. Defaults to `process.env`. Injecting an empty object
   * pins the terse path; injecting `{ SIRO_DEBUG: '1' }` pins the
   * verbose path — tests use both shapes.
   */
  env?: Record<string, string | undefined>;
  /**
   * Used by `loadLib` to verify the computed root before resolving a TS
   * module against it. Defaults to `fs.existsSync`. Tests inject a stub
   * to drive the misroot diagnostic without a temp directory.
   */
  fileExists?: (path: string) => boolean;
}

export interface LoadLibOptions {
  /**
   * When true, use a fresh jiti instance with both transform and module
   * caches disabled, so files the default instance already saw are re-read.
   * Needed by gen-rule, which writes a TS file then immediately imports a
   * lib that transitively reads it.
   */
  fresh?: boolean;
}

export interface ScriptContext {
  readonly root: string;
  readonly name: string;
  /**
   * Accepts a string, an Error, or any other thrown value (defence
   * against `throw 42`). Errors print just their `message` by default;
   * passing `SIRO_DEBUG=1` adds the stack so a CI run with a mysterious
   * driver crash can be re-run with `SIRO_DEBUG=1` and surface the
   * origin without code edits.
   */
  fail: (messageOrError: string | Error | unknown, exitCode?: number) => never;
  logSuccess: (label: string) => void;
  loadLib: <TLib = unknown>(relPath: string, options?: LoadLibOptions) => Promise<TLib>;
}

export function resolveRoot(importMetaUrl: string): string;
export function scriptName(importMetaUrl: string): string;
export function createScriptContext(importMetaUrl: string, deps?: ScriptContextDeps): ScriptContext;
