declare const AbsPathBrand: unique symbol;
declare const RelPathBrand: unique symbol;

export type AbsPath = string & { readonly [AbsPathBrand]: true };
export type RelPath = string & { readonly [RelPathBrand]: true };

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
