import path from 'node:path';

declare const AbsPathBrand: unique symbol;
declare const RelPathBrand: unique symbol;

export type AbsPath = string & { readonly [AbsPathBrand]: true };
export type RelPath = string & { readonly [RelPathBrand]: true };

export const isAbsPath = (value: unknown): value is AbsPath =>
  typeof value === 'string' && !value.includes('\0') && path.isAbsolute(value);

export const isRelPath = (value: unknown): value is RelPath =>
  typeof value === 'string' &&
  value.length > 0 &&
  !value.includes('\0') &&
  !path.posix.isAbsolute(value) &&
  !path.win32.isAbsolute(value) &&
  !/^[a-z]:/iu.test(value) &&
  !value.split(/[\\/]/u).includes('..');

export const asAbsPath = (value: string): AbsPath => {
  if (!isAbsPath(value)) throw new TypeError('Expected an absolute filesystem path.');
  return value;
};

export const asRelPath = (value: string): RelPath => {
  if (!isRelPath(value))
    throw new TypeError('Expected a repository-relative path without parent traversal.');
  return value;
};
