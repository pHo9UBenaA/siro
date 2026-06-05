import type { CheckStatus, Rule } from '../../../src/domain/entities/rule.ts';
import type { CodecFor, ConfigCodec } from '../../../src/domain/ports/config-codec.ts';
import { asAbsPath, asRelPath } from '../../../src/shared/paths.ts';
import type { ParsedConfig } from '../../../src/domain/entities/config-value.ts';
import type { RepoContext } from '../../../src/domain/ports/repo-context.ts';
import { createConfigParser } from '../../../src/domain/services/parse-config-file.ts';
import { evaluateBindings } from '../../../src/domain/services/evaluate-bindings.ts';

vi.setConfig({ testTimeout: 5000 });

const SINGLE_CALL = 1;
const FIRST_ELEMENT = 0;

const noopCtx: RepoContext = {
  exists: () => false,
  packageJson: void 0,
  readText: (): undefined => void 0,
  root: asAbsPath('/repo'),
};

const noopCodecFor: CodecFor = (): ConfigCodec => ({
  parse: (): ParsedConfig => ({}),
});

const ruleWith = (id: string, pms: readonly ('npm' | 'pnpm')[], status: CheckStatus): Rule => ({
  bindings: Object.fromEntries(
    pms.map((pm) => [
      pm,
      {
        check: (): CheckStatus => status,
        file: { kind: 'npmrc', path: asRelPath('.npmrc') } as const,
        fix: (): readonly [] => [],
        fixKind: 'auto' as const,
      },
    ]),
  ),
  description: id,
  id,
  severity: 'warn',
  title: id,
});

describe('evaluateBindings — violation delivery', () => {
  it('invokes the visitor for every (rule, pm) binding that reports a violation', () => {
    expect.hasAssertions();
    const violating: CheckStatus = { message: 'x', state: 'violation' };
    const ruleSet: Rule[] = [
      ruleWith('a', ['npm', 'pnpm'], violating),
      ruleWith('b', ['npm'], violating),
    ];
    const visited: string[] = [];
    evaluateBindings({
      ctx: noopCtx,
      onViolation: ({ rule, pm }) => visited.push(`${rule.id}:${pm}`),
      parseConfig: createConfigParser(noopCodecFor),
      pms: ['npm', 'pnpm'],
      ruleSet,
    });
    expect(visited).toStrictEqual(['a:npm', 'a:pnpm', 'b:npm']);
  });
});

describe('evaluateBindings — non-violation filtering', () => {
  it('skips bindings that report ok or na', () => {
    expect.hasAssertions();
    const ruleSet: Rule[] = [
      ruleWith('ok', ['npm'], { state: 'ok' }),
      ruleWith('na', ['npm'], { state: 'na' }),
      ruleWith('v', ['npm'], { message: 'x', state: 'violation' }),
    ];
    const visited: string[] = [];
    evaluateBindings({
      ctx: noopCtx,
      onViolation: ({ rule }) => visited.push(rule.id),
      parseConfig: createConfigParser(noopCodecFor),
      pms: ['npm'],
      ruleSet,
    });
    expect(visited).toStrictEqual(['v']);
  });

  it('skips PMs without a binding instead of recording N/A', () => {
    expect.hasAssertions();
    const ruleSet: Rule[] = [ruleWith('a', ['npm'], { message: 'x', state: 'violation' })];
    const visited: string[] = [];
    evaluateBindings({
      ctx: noopCtx,
      onViolation: ({ pm }) => visited.push(pm),
      parseConfig: createConfigParser(noopCodecFor),
      pms: ['npm', 'pnpm', 'yarn'],
      ruleSet,
    });
    expect(visited).toStrictEqual(['npm']);
  });
});

describe('evaluateBindings — parser reuse', () => {
  it('reuses the caller-provided parser so a fix-side re-read is a cache hit', () => {
    expect.hasAssertions();
    let parseCalls = 0;
    const parser = createConfigParser((kind) => {
      parseCalls += SINGLE_CALL;
      return noopCodecFor(kind);
    });
    const ruleSet: Rule[] = [ruleWith('a', ['npm'], { message: 'x', state: 'violation' })];
    evaluateBindings({
      ctx: noopCtx,
      onViolation: ({ binding }) => {
        parser(noopCtx, binding.file);
      },
      parseConfig: parser,
      pms: ['npm'],
      ruleSet,
    });
    expect(parseCalls).toBe(SINGLE_CALL);
  });
});

describe('evaluateBindings — fileGlob bindings', () => {
  it('delivers a fileGlob binding violation to the visitor with an empty parsed view', () => {
    expect.hasAssertions();
    const capturedParsed: ParsedConfig[] = [];
    const rule: Rule = {
      bindings: {
        npm: {
          check: (_ctx, parsed) => {
            capturedParsed.push(parsed);
            return { message: 'no lockfile', state: 'violation' };
          },
          file: { kind: 'fileGlob', path: asRelPath('*.lock') },
          fix: () => [],
          fixKind: 'advisory',
        },
      },
      description: 'glob-rule',
      id: 'glob-rule',
      severity: 'error',
      title: 'glob-rule',
    };
    const visited: string[] = [];
    evaluateBindings({
      ctx: noopCtx,
      onViolation: ({ rule: rl }) => {
        visited.push(rl.id);
      },
      parseConfig: createConfigParser(noopCodecFor),
      pms: ['npm'],
      ruleSet: [rule],
    });
    expect(visited).toStrictEqual(['glob-rule']);
    expect(capturedParsed[FIRST_ELEMENT]).toStrictEqual({});
  });
});
