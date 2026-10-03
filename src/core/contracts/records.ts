/** Narrow a property name before indexing a closed object table. */
export const isOwnKey = <T extends object>(record: T, key: PropertyKey): key is keyof T =>
  Object.hasOwn(record, key);

/** Configuration maps are ordinary objects or null-prototype dictionaries. */
export const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
