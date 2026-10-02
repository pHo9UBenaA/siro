import { types } from 'node:util';
import { outputBudget } from '../../core/contracts/scan-limits.ts';
import { safeJsonText } from '../safe-text.ts';

const isOmittedJsonValue = (value: unknown) =>
  value === undefined || typeof value === 'function' || typeof value === 'symbol';

const normalizeJsonValue = (value: unknown, key: string): unknown => {
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function' || typeof value === 'bigint')
  ) {
    const toJSON = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJSON === 'function') value = Reflect.apply(toJSON, value, [key]);
  }
  if (types.isNumberObject(value)) return +value;
  if (types.isStringObject(value)) return `${value}`;
  if (types.isBooleanObject(value)) return Boolean.prototype.valueOf.call(value);
  if (types.isBigIntObject(value)) return BigInt.prototype.valueOf.call(value);
  return value;
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
    let emittedEntryCount = 0;
    const serializeEntry = (key: string, raw: unknown) => {
      const child = normalizeJsonValue(raw, key);
      if (!isArray && isOmittedJsonValue(child)) return;
      const separator = emittedEntryCount === 0 ? '\n' : ',\n';
      emit(`${separator}${'  '.repeat(depth)}`);
      emittedEntryCount += 1;
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
      for (const key of Object.keys(value))
        serializeEntry(key, (value as Record<string, unknown>)[key]);
    }
    if (emittedEntryCount) emit(`\n${'  '.repeat(depth - 1)}`);
    emit(isArray ? ']' : '}');
    activeContainers.delete(value);
  };
  serialize(normalizeJsonValue(input, ''), 1);
  consume('\n');
  return chunks.join('');
};
