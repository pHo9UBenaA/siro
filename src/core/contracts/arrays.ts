/** Reject sparse slots and ignore custom iterators without copying the array. */
export const isArrayOf = <T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is T[] => {
  if (!Array.isArray(value)) return false;
  const length = value.length;
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(value, index) || !isItem(value[index])) return false;
  }
  return true;
};

export const isStringArray = (value: unknown): value is string[] =>
  isArrayOf(value, (item): item is string => typeof item === 'string');
