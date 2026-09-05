import { automaticOperations } from '../../helpers/remediation.ts';
import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/domain/entities/config-value.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { strictAllowScripts } from '../../../src/domain/rules/strict-allow-scripts.ts';

vi.setConfig({ testTimeout: 5000 });

const { npm } = strictAllowScripts.bindings;
assert(npm, 'expected npm binding');

describe('strict-allow-scripts', () => {
  it('passes when strict-allow-scripts is true', () => {
    expect.hasAssertions();
    expect(npm.check(makeCtx(), { 'strict-allow-scripts': true }).state).toBe('ok');
  });

  it('requires manual bypass removal even when strict-allow-scripts is true', () => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), {
      'dangerously-allow-all-scripts': true,
      'strict-allow-scripts': true,
    });
    expect(status).toMatchObject({
      remediation: {
        kind: 'manual',
        steps: [expect.stringContaining('dangerously-allow-all-scripts')],
      },
      state: 'violation',
    });
  });

  it.each<ParsedConfig>([
    { 'ignore-scripts': true },
    { 'ignore-scripts': true, 'strict-allow-scripts': false },
    {
      'dangerously-allow-all-scripts': true,
      'ignore-scripts': true,
      'strict-allow-scripts': true,
    },
  ])('passes when ignore-scripts blocks script execution (%j)', (config) => {
    expect.hasAssertions();
    expect(npm.check(makeCtx(), config).state).toBe('ok');
  });

  it('flags a violation when unset', () => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when set to false', () => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), { 'strict-allow-scripts': false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('only binds to npm', () => {
    expect.hasAssertions();
    expect(strictAllowScripts.bindings.npm).toBeDefined();
    expect(strictAllowScripts.bindings.yarn).toBeUndefined();
    expect(strictAllowScripts.bindings.pnpm).toBeUndefined();
    expect(strictAllowScripts.bindings.bun).toBeUndefined();
    expect(strictAllowScripts.bindings.deno).toBeUndefined();
    expect(strictAllowScripts.bindings.aube).toBeUndefined();
  });

  it('ships at warn severity and targets .npmrc', () => {
    expect.hasAssertions();
    expect(strictAllowScripts.severity).toBe('warn');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('fix returns setKey op for strict-allow-scripts: true', () => {
    expect.hasAssertions();
    const ops = automaticOperations(npm.check(makeCtx(), {}));
    expect(ops).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['strict-allow-scripts'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});
