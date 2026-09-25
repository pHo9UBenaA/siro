import type { ConfigFileRef } from '../../src/core/contracts/config-file-ref.ts';
import type { CodecFor, ConfigCodec } from '../../src/core/contracts/config-codec.ts';
import { createConfigParser } from '../../src/core/parse-config-file.ts';
import { ConfigError } from '../../src/core/contracts/errors.ts';
import { asRelPath } from '../../src/core/contracts/paths.ts';
import { makeCtx } from '../helpers/ctx.ts';

const makeCodec = (parse: ConfigCodec['parse']): ConfigCodec => ({
  parse,
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

  it('wraps codec errors as ConfigError, including file.path and the codec message', () => {
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
    expect(() => parseConfig(file)).toThrow(/unexpected token/u);
  });
});
