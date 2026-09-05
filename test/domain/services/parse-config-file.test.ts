import type { CodecFor, ConfigCodec } from '../../../src/domain/ports/config-codec.ts';
import { yamlCodec } from '../../../src/adapters/codecs/yaml.ts';
import { ConfigError } from '../../../src/shared/errors.ts';
import type { ConfigFileRef } from '../../../src/domain/entities/rule.ts';
import type { RepoContext } from '../../../src/domain/ports/repo-context.ts';
import { asRelPath } from '../../../src/shared/paths.ts';
import { createConfigParser } from '../../../src/domain/services/parse-config-file.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

const PARSE_ONCE = 1;
const PARSE_TWICE = 2;

const makeCodec = (parse: ConfigCodec['parse']): ConfigCodec => ({
  parse,
});

describe('createConfigParser — same-instance memoization', () => {
  it('memoizes by (kind, path): same file is parsed once across two calls', () => {
    expect.hasAssertions();
    const parse = vi.fn<ConfigCodec['parse']>().mockReturnValue({ val: 1 });
    const codecFor: CodecFor = () => makeCodec(parse);
    const ctx = makeCtx({ readText: () => 'raw=text' });
    const file: ConfigFileRef = { kind: 'npmrc', path: asRelPath('.npmrc') };
    const parseConfig = createConfigParser(codecFor);

    const first = parseConfig(ctx, file);
    parseConfig(ctx, file);

    expect(first).toStrictEqual({ val: 1 });
    expect(parse).toHaveBeenCalledTimes(PARSE_ONCE);
  });

  it('caches the parsed view so callers do not re-read', () => {
    expect.hasAssertions();
    const readText = vi.fn<RepoContext['readText']>().mockReturnValue('raw=text');
    const parse = vi.fn<ConfigCodec['parse']>().mockReturnValue({ val: 1 });
    const codecFor: CodecFor = () => makeCodec(parse);
    const ctx = makeCtx({ readText });
    const file: ConfigFileRef = { kind: 'npmrc', path: asRelPath('.npmrc') };
    const parseConfig = createConfigParser(codecFor);

    parseConfig(ctx, file);
    parseConfig(ctx, file);

    expect(readText).toHaveBeenCalledTimes(PARSE_ONCE);
  });
});

describe('createConfigParser — cross-instance isolation', () => {
  it('two parser instances do not share a cache (the cache scope is the factory call)', () => {
    expect.hasAssertions();
    const parse = vi.fn<ConfigCodec['parse']>().mockReturnValue({ val: 1 });
    const codecFor: CodecFor = () => makeCodec(parse);
    const ctx = makeCtx({ readText: () => 'raw=text' });
    const file: ConfigFileRef = { kind: 'npmrc', path: asRelPath('.npmrc') };

    createConfigParser(codecFor)(ctx, file);
    createConfigParser(codecFor)(ctx, file);

    expect(parse).toHaveBeenCalledTimes(PARSE_TWICE);
  });
});

describe('createConfigParser — error handling', () => {
  it('treats a missing optional config file as empty without invoking its codec', () => {
    expect.hasAssertions();
    const parse = vi.fn<ConfigCodec['parse']>();
    const codecFor: CodecFor = () => makeCodec(parse);
    const ctx = makeCtx({ readText: () => undefined });
    const file: ConfigFileRef = { kind: 'json', path: asRelPath('deno.json') };

    expect(createConfigParser(codecFor)(ctx, file)).toStrictEqual({});
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
    const parseConfig = createConfigParser(codecFor);

    expect(() => parseConfig(ctx, file)).toThrow(ConfigError);
    expect(() => parseConfig(ctx, file)).toThrow(/pnpm-workspace\.yaml/u);
    expect(() => parseConfig(ctx, file)).toThrow(/unexpected token/u);
  });

  it('rejects cyclic YAML aliases as ConfigError', () => {
    expect.hasAssertions();
    const codecFor: CodecFor = () => yamlCodec;
    const ctx = makeCtx({ readText: () => 'root: &root\n  self: *root' });
    const file: ConfigFileRef = { kind: 'yaml', path: asRelPath('pnpm-workspace.yaml') };
    const parseConfig = createConfigParser(codecFor);

    expect(() => parseConfig(ctx, file)).toThrow(ConfigError);
  });
});

describe('createConfigParser — fileGlob', () => {
  it('returns an empty object for fileGlob bindings without invoking the codec', () => {
    expect.hasAssertions();
    const parse = vi.fn<ConfigCodec['parse']>();
    const codecFor: CodecFor = () => makeCodec(parse);
    const ctx = makeCtx();
    const file: ConfigFileRef = { kind: 'fileGlob', path: asRelPath('**/*.lock') };

    const result = createConfigParser(codecFor)(ctx, file);

    expect(result).toStrictEqual({});
    expect(parse).not.toHaveBeenCalled();
  });
});
