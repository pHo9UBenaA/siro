import type { CheckStatus, Rule } from '../../src/domain/entities/rule.ts';
import type { CodecFor, ConfigCodec } from '../../src/domain/ports/config-codec.ts';
import { asAbsPath, asRelPath } from '../../src/shared/paths.ts';
import type { ParsedConfig } from '../../src/domain/entities/config-value.ts';
import type { RepoContext } from '../../src/domain/ports/repo-context.ts';
import { runLint } from '../../src/application/run-lint.ts';

const noopCtx: RepoContext = {
  exists: () => false,
  packageJson: undefined,
  readText: () => undefined,
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
      },
    ]),
  ),
  description: id,
  id,
  severity: 'warn',
  title: id,
});

const lint = (
  ctx: RepoContext,
  ruleSet: readonly Rule[],
  pms: readonly ('npm' | 'pnpm' | 'yarn' | 'deno')[],
) => runLint({ codecFor: noopCodecFor, ctx, pms, ruleSet });

describe('runLint binding evaluation', () => {
  it('reports every violating rule and PM binding in stable order', () => {
    expect.hasAssertions();
    const violation: CheckStatus = { message: 'x', state: 'violation' };
    const result = lint(
      noopCtx,
      [ruleWith('a', ['npm', 'pnpm'], violation), ruleWith('b', ['npm'], violation)],
      ['npm', 'pnpm'],
    );
    expect(result.findings.map(({ ruleId, pm }) => `${ruleId}:${pm}`)).toStrictEqual([
      'a:npm',
      'a:pnpm',
      'b:npm',
    ]);
  });

  it('skips bindings that report ok or na and PMs without a binding', () => {
    expect.hasAssertions();
    const result = lint(
      noopCtx,
      [
        ruleWith('ok', ['npm'], { state: 'ok' }),
        ruleWith('na', ['npm'], { state: 'na' }),
        ruleWith('violation', ['npm'], { message: 'x', state: 'violation' }),
      ],
      ['npm', 'pnpm', 'yarn'],
    );
    expect(result.findings.map(({ ruleId }) => ruleId)).toStrictEqual(['violation']);
  });
});

describe('runLint project selection', () => {
  it('skips a package-only custom rule for an inferred application', () => {
    expect.hasAssertions();
    const rule: Rule = {
      ...ruleWith('package-only', ['npm'], { message: 'x', state: 'violation' }),
      projectTypes: ['package'],
    };
    const result = lint(
      { ...noopCtx, packageJson: { name: 'private-app', private: true } },
      [rule],
      ['npm'],
    );
    expect(result.findings).toStrictEqual([]);
  });

  it('skips a package-only custom rule for a nameless Deno application', () => {
    expect.hasAssertions();
    const rule: Rule = {
      bindings: {
        deno: {
          check: () => ({ message: 'x', state: 'violation' }),
          file: { kind: 'json', path: asRelPath('custom.json') },
        },
      },
      description: 'package-only-deno',
      id: 'package-only-deno',
      projectTypes: ['package'],
      severity: 'warn',
      title: 'package-only-deno',
    };
    expect(lint(noopCtx, [rule], ['deno']).findings).toStrictEqual([]);
  });

  it('does not read deno.json to classify an unscoped Deno rule', () => {
    expect.hasAssertions();
    const reads: string[] = [];
    const ctx: RepoContext = {
      ...noopCtx,
      readText: (file) => {
        reads.push(file);
        return '{}';
      },
    };
    const rule: Rule = {
      bindings: {
        deno: {
          check: () => ({ state: 'ok' }),
          file: { kind: 'json', path: asRelPath('custom.json') },
        },
      },
      description: 'unscoped-deno',
      id: 'unscoped-deno',
      severity: 'warn',
      title: 'unscoped-deno',
    };
    lint(ctx, [rule], ['deno']);
    expect(reads).toStrictEqual(['custom.json']);
  });
});

describe('runLint repository checks', () => {
  it('passes an empty parsed view without invoking a codec', () => {
    expect.hasAssertions();
    const parse = vi.fn<ConfigCodec['parse']>();
    const captured: ParsedConfig[] = [];
    const rule: Rule = {
      bindings: {
        npm: {
          check: (_ctx, parsed) => {
            captured.push(parsed);
            return { message: 'no lockfile', state: 'violation' };
          },
        },
      },
      description: 'glob-rule',
      id: 'glob-rule',
      severity: 'error',
      title: 'glob-rule',
    };

    const result = runLint({
      codecFor: () => ({ parse }),
      ctx: noopCtx,
      pms: ['npm'],
      ruleSet: [rule],
    });

    expect(result.findings.map(({ ruleId }) => ruleId)).toStrictEqual(['glob-rule']);
    expect(captured).toStrictEqual([{}]);
    expect(parse).not.toHaveBeenCalled();
  });
});

it('reports Aube install-command guidance without reading workspace configuration', async () => {
  const { frozenLockfile } = await import('../../src/domain/rules/frozen-lockfile.ts');
  const result = runLint({
    ctx: {
      ...noopCtx,
      readText() {
        throw new Error('Workspace configuration is not needed');
      },
    },
    pms: ['aube'],
    ruleSet: [frozenLockfile],
    codecFor: noopCodecFor,
  });
  expect(result.findings).toMatchObject([
    { ruleId: 'frozen-lockfile', remediation: { kind: 'manual' } },
  ]);
});
