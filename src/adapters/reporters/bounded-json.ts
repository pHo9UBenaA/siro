import { types } from 'node:util';
import { outputBudget } from '../../core/contracts/scan-limits.ts';
import { safeJsonText } from '../safe-text.ts';

const isOmittedJsonValue = (value: unknown) =>
  value === undefined || typeof value === 'function' || typeof value === 'symbol';

const normalizeJsonValue = (value: unknown, key: string): unknown => {
  const canHaveToJSON =
    value !== null &&
    (typeof value === 'object' || typeof value === 'function' || typeof value === 'bigint');
  // Box primitive BigInts for property lookup, retaining the original getter receiver.
  const toJSON: unknown = canHaveToJSON ? Reflect.get(Object(value), 'toJSON', value) : undefined;
  const normalized: unknown =
    typeof toJSON === 'function' ? Reflect.apply(toJSON, value, [key]) : value;
  // Native JSON coerces number/string wrappers, but ignores overridden valueOf
  // on boolean/bigint wrappers. Node's guards also recognize cross-realm wrappers.
  if (types.isNumberObject(normalized)) return +normalized;
  if (types.isStringObject(normalized)) return `${normalized}`;
  if (types.isBooleanObject(normalized)) return Boolean.prototype.valueOf.call(normalized);
  if (types.isBigIntObject(normalized)) return BigInt.prototype.valueOf.call(normalized);
  return normalized;
};

/** Serialize incrementally into bounded chunks before allocating the final JSON document.
 * JSON primitives use the native encoder; containers preserve its own-key/array/toJSON semantics.
 */
export const boundedJson = (input: unknown, maxBytes: number, maxDepth: number): string => {
  const consume = outputBudget(maxBytes);
  const chunks: string[] = [];
  const activeContainers = new Set<object>();
  const emit = (text: string) => {
    const escaped = safeJsonText(text);
    consume(escaped);
    chunks.push(escaped);
  };
  const serialize = (value: unknown, depth: number): void => {
    if (typeof value === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
    if (value === null || typeof value !== 'object') {
      emit(JSON.stringify(value) ?? 'null');
      return;
    }
    if (activeContainers.has(value)) throw new TypeError('Cannot serialize a circular report.');
    if (depth > maxDepth) throw new TypeError('Report nesting exceeds the configured depth.');
    activeContainers.add(value);
    const isArray = Array.isArray(value);
    emit(isArray ? '[' : '{');
    let hasEntries = false;
    const serializeEntry = (key: string, raw: unknown) => {
      const child = normalizeJsonValue(raw, key);
      if (!isArray && isOmittedJsonValue(child)) return;
      const separator = hasEntries ? ',\n' : '\n';
      emit(`${separator}${'  '.repeat(depth)}`);
      hasEntries = true;
      if (!isArray) {
        emit(JSON.stringify(key));
        emit(': ');
      }
      serialize(isOmittedJsonValue(child) ? null : child, depth + 1);
    };
    if (isArray) {
      const length = value.length;
      for (let index = 0; index < length; index++) serializeEntry(String(index), value[index]);
    } else {
      for (const key of Object.keys(value)) serializeEntry(key, Reflect.get(value, key));
    }
    if (hasEntries) emit(`\n${'  '.repeat(depth - 1)}`);
    emit(isArray ? ']' : '}');
    activeContainers.delete(value);
  };
  serialize(normalizeJsonValue(input, ''), 1);
  consume('\n');
  return chunks.join('');
};
