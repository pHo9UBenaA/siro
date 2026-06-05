/**
 * Node-runtime error helpers. Lives in the adapters layer so the shared
 * module can stay runtime-agnostic — domain code transitively imports
 * `shared/errors.ts`, and pulling Node's global type namespace through that
 * path would couple every layer to `@types/node` for no reason beyond a
 * single type guard.
 */

/**
 * Type guard for Node FS / system errors. `catch` exposes `unknown`, so every
 * `errno`-aware branch needs to prove the shape before reading `code` —
 * centralized here so callers don't sprinkle `as NodeJS.ErrnoException`.
 */
export const isNodeError = (value: unknown): value is NodeJS.ErrnoException =>
  value instanceof Error && 'code' in value && typeof value.code === 'string';
