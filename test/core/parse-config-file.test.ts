import type { ConfigFileRef } from '../../src/core/contracts/config-file-ref.ts';
import type { CodecFor, ConfigCodec } from '../../src/core/contracts/config-codec.ts';
import {
  createConfigParser,
  createRepositoryEvaluation,
} from '../../src/core/parse-config-file.ts';
import { ConfigError } from '../../src/core/contracts/errors.ts';
import { asRelPath } from '../../src/core/contracts/paths.ts';
import { makeCtx } from '../helpers/ctx.ts';

const makeCodec = (parse: ConfigCodec['parse']): ConfigCodec => ({
  parse,
});

it('pairs a context with a fresh lazy parser without reading ahead', () => {
  const readText = vi.fn<() => string>(() => '{}');
  const ctx = makeCtx({ readText });
  const parse = vi.fn<ConfigCodec['parse']>(() => ({ approved: true }));
  const codecFor: CodecFor = () => makeCodec(parse);
  const first = createRepositoryEvaluation(ctx, codecFor);
  const second = createRepositoryEvaluation(ctx, codecFor);
  expect(first.ctx).toBe(ctx);
  expect(second.ctx).toBe(ctx);
  expect(readText).not.toHaveBeenCalled();
  expect(parse).not.toHaveBeenCalled();
  const file: ConfigFileRef = { kind: 'json', path: asRelPath('deno.json') };
  first.parseConfig(file);
  first.parseConfig(file);
  expect(readText).toHaveBeenCalledTimes(1);
  second.parseConfig(file);
  expect(readText).toHaveBeenCalledTimes(2);
  expect(parse).toHaveBeenCalledTimes(2);
});

describe('createConfigParser — error handling', () => {
  it('treats a missing optional config file as empty without invoking its codec', () => {
    expect.hasAssertions();
    const parse = vi.fn<ConfigCodec['parse']>();
    const codecFor: CodecFor = () => makeCodec(parse);
    const ctx = makeCtx({ readText: () => undefined });
    const file: ConfigFileRef = { kind: 'json', path: asRelPath('deno.json') };

    expect(createConfigParser(codecFor, ctx)(file)).toStrictEqual({});
    expect(parse).not.toHaveBeenCalled();
  });

  it('does not cache a filesystem failure, but caches the first successful parse', () => {
    const failure = new Error('Read failed');
    const readText = vi
      .fn<() => string>()
      .mockImplementationOnce(() => {
        throw failure;
      })
      .mockReturnValue('{}');
    const parse = vi.fn<ConfigCodec['parse']>(() => ({ approved: true }));
    const parseConfig = createConfigParser(() => makeCodec(parse), makeCtx({ readText }));
    const file: ConfigFileRef = { kind: 'json', path: asRelPath('deno.json') };
    let caught: unknown;
    try {
      parseConfig(file);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(parse).not.toHaveBeenCalled();
    const value = parseConfig(file);
    expect(parseConfig(file)).toBe(value);
    expect(value).toEqual({ approved: true });
    expect(readText).toHaveBeenCalledTimes(2);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('retries a codec failure rather than caching it as an empty config', () => {
    const readText = vi.fn<() => string>(() => '{}');
    const parse = vi
      .fn<ConfigCodec['parse']>()
      .mockImplementationOnce(() => {
        throw new Error('Invalid input');
      })
      .mockReturnValue({ approved: true });
    const parseConfig = createConfigParser(() => makeCodec(parse), makeCtx({ readText }));
    const file: ConfigFileRef = { kind: 'json', path: asRelPath('deno.json') };
    expect(() => parseConfig(file)).toThrow('deno.json: Invalid configuration.');
    expect(parseConfig(file)).toEqual({ approved: true });
    expect(readText).toHaveBeenCalledTimes(2);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('shares an absent file only within its parser lifetime', () => {
    const readText = vi
      .fn<() => string | undefined>()
      .mockReturnValueOnce(undefined)
      .mockReturnValue('{}');
    const parse = vi.fn<ConfigCodec['parse']>(() => ({ approved: true }));
    const codecFor: CodecFor = () => makeCodec(parse);
    const ctx = makeCtx({ readText });
    const file: ConfigFileRef = { kind: 'json', path: asRelPath('deno.json') };
    const parseConfig = createConfigParser(codecFor, ctx);
    expect(parseConfig(file)).toEqual({});
    expect(parseConfig(file)).toEqual({});
    expect(readText).toHaveBeenCalledTimes(1);
    expect(parse).not.toHaveBeenCalled();
    expect(createConfigParser(codecFor, ctx)(file)).toEqual({ approved: true });
    expect(readText).toHaveBeenCalledTimes(2);
  });

  it('wraps codec errors with file.path without disclosing unknown codec messages', () => {
    expect.hasAssertions();
    const codecFor: CodecFor = () =>
      makeCodec(() => {
        throw new Error('unexpected token');
      });
    const ctx = makeCtx({ readText: () => 'garbage' });
    const file: ConfigFileRef = { kind: 'yaml', path: asRelPath('pnpm-workspace.yaml') };
    const parseConfig = createConfigParser(codecFor, ctx);

    expect(() => parseConfig(file)).toThrow(ConfigError);
    expect(() => parseConfig(file)).toThrow(/pnpm-workspace\.yaml/u);
    expect(() => parseConfig(file)).toThrow(/Invalid configuration/u);
  });
});
