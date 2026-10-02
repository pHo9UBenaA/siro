import { types } from 'node:util';
import { outputBudget } from '../../core/contracts/scan-limits.ts';
import { safeJsonText } from '../safe-text.ts';

const omitted = (value: unknown) =>
  value === undefined || typeof value === 'function' || typeof value === 'symbol';

/** Serialize incrementally into bounded chunks before allocating the final JSON document.
 * JSON primitives use the native encoder; containers preserve its own-key/array/toJSON semantics.
 */
export const boundedJson = (input: unknown, maxBytes: number, maxDepth: number): string => {
  const consume = outputBudget(maxBytes);
  const chunks: string[] = [];
  const active = new Set<object>();
  const emit = (text: string) => {
    const escaped = safeJsonText(text);
    consume(escaped);
    chunks.push(escaped);
  };
  const normalize = (value: unknown, key: string): unknown => {
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
  const serialize = (value: unknown, depth: number): void => {
    if (typeof value === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
    if (value === null || typeof value !== 'object') {
      emit(JSON.stringify(value) ?? 'null');
      return;
    }
    if (active.has(value)) throw new TypeError('Cannot serialize a circular report.');
    if (depth > maxDepth) throw new TypeError('Report nesting exceeds the configured depth.');
    active.add(value);
    const array = Array.isArray(value);
    emit(array ? '[' : '{');
    let count = 0;
    const entry = (key: string, raw: unknown) => {
      const child = normalize(raw, key);
      if (!array && omitted(child)) return;
      emit(`${count++ === 0 ? '\n' : ',\n'}${'  '.repeat(depth)}`);
      if (!array) {
        emit(JSON.stringify(key));
        emit(': ');
      }
      serialize(omitted(child) ? null : child, depth + 1);
    };
    if (array) {
      const length = value.length;
      for (let index = 0; index < length; index++) entry(String(index), value[index]);
    } else {
      for (const key of Object.keys(value)) entry(key, (value as Record<string, unknown>)[key]);
    }
    if (count) emit(`\n${'  '.repeat(depth - 1)}`);
    emit(array ? ']' : '}');
    active.delete(value);
  };
  serialize(normalize(input, ''), 1);
  consume('\n');
  return chunks.join('');
};
