/** Check every iterated entry, including sparse slots, without copying the array. */
export const isArrayOf = <T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is T[] => {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (!isItem(item)) return false;
  }
  return true;
};

export const isStringArray = (value: unknown): value is string[] =>
  isArrayOf(value, (item): item is string => typeof item === 'string');
