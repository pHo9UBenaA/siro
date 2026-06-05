import assert from 'node:assert';
import { isNodeError } from '../../src/adapters/node-errors.ts';

vi.setConfig({ testTimeout: 5000 });

describe(isNodeError, () => {
  it('accepts an Error whose code is a string (NodeJS.ErrnoException shape)', () => {
    expect.hasAssertions();
    const err = Object.assign(new Error('boom'), { code: 'ENOENT' });
    expect(isNodeError(err)).toBe(true);
    assert(isNodeError(err), 'expected a Node error');
    expect(err.code).toBe('ENOENT');
  });

  it('rejects a plain Error without a code property', () => {
    expect.hasAssertions();
    expect(isNodeError(new Error('nope'))).toBe(false);
  });

  it('rejects a non-Error value (string, plain object, undefined)', () => {
    expect.hasAssertions();
    expect(isNodeError('ENOENT')).toBe(false);
    expect(isNodeError({ code: 'ENOENT' })).toBe(false);
    const [noArg]: unknown[] = [];
    expect(isNodeError(noArg)).toBe(false);
    const nullValue: unknown = JSON.parse('null');
    expect(isNodeError(nullValue)).toBe(false);
  });

  it('rejects an Error whose code is non-string (number, undefined)', () => {
    expect.hasAssertions();
    expect(isNodeError(Object.assign(new Error('test'), { code: 42 }))).toBe(false);
    expect(isNodeError(Object.assign(new Error('test'), { code: void 0 }))).toBe(false);
  });

  it('accepts an Error whose code is the empty string (still typeof string)', () => {
    expect.hasAssertions();
    expect(isNodeError(Object.assign(new Error('test'), { code: '' }))).toBe(true);
  });
});
