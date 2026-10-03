import { isArrayOf } from '../contracts/arrays.ts';

export const isNonBlankString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Empty arrays are valid; blank strings and sparse entries are not. */
export const isNonBlankStringArray = (value: unknown): value is string[] =>
  isArrayOf(value, isNonBlankString);

export const isNonEmptyObject = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0;
