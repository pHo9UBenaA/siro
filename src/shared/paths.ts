/**
 * Branded path types. Surface the distinction between
 *   - `AbsPath`: absolute filesystem paths handed to the FS boundary
 *     (`FileSystem.readText` etc.), and
 *   - `RelPath`: paths relative to a repo root, accepted by
 *     `RepoContext` and resolved via `resolveIn`.
 *
 * The brand is a structural tag with no runtime footprint — the cast in
 * `asAbsPath` / `asRelPath` is the only place either type is minted, so
 * passing a raw `string` to an FS or repo API now requires the caller to
 * declare intent rather than silently mixing the two flavours.
 */

declare const AbsPathBrand: unique symbol;
declare const RelPathBrand: unique symbol;

export type AbsPath = string & { readonly [AbsPathBrand]: true };
export type RelPath = string & { readonly [RelPathBrand]: true };

/** Tag a string as absolute. The caller vouches for the shape. */
export const asAbsPath = (path: string): AbsPath => path as AbsPath;

/** Tag a string as repo-root-relative. The caller vouches for the shape. */
export const asRelPath = (path: string): RelPath => path as RelPath;
