export const isNonBlankString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && Array.from(value).every(isNonBlankString);
