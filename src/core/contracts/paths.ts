declare const AbsPathBrand: unique symbol;
declare const RelPathBrand: unique symbol;

export type AbsPath = string & { readonly [AbsPathBrand]: true };
export type RelPath = string & { readonly [RelPathBrand]: true };

// Host-validated native names may contain POSIX backslashes or colons.
// Composed paths use '/' separators; portable user input has stricter checks below.
const isSlashRelativePath = (value: unknown): value is RelPath =>
  typeof value === 'string' &&
  value.length > 0 &&
  !value.includes('\0') &&
  !value.startsWith('/') &&
  !value.split('/').includes('..');

export const joinRelativePath = (parent: RelPath, child: RelPath): RelPath => {
  const joined = parent === '.' ? child : `${parent}/${child}`;
  if (!isSlashRelativePath(joined)) throw new TypeError('Invalid composed repository path.');
  return joined;
};

export const isRelPath = (value: unknown): value is RelPath =>
  typeof value === 'string' &&
  value.length > 0 &&
  !value.includes('\0') &&
  !/^[\\/]/u.test(value) &&
  !/^[a-z]:/iu.test(value) &&
  !value.split(/[\\/]/u).includes('..');

export const asRelPath = (value: string): RelPath => {
  if (!isRelPath(value))
    throw new TypeError('Expected a repository-relative path without parent traversal.');
  return value;
};
