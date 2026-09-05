/** Recognize record containers without treating built-ins as empty dictionaries. */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) {
    return true;
  }
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
  return typeof constructor !== 'function' || constructor.name === 'Object';
};
