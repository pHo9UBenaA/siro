import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { strictAllowScripts } from '../../../src/core/rules/strict-allow-scripts.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

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

  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = npm.check(makeCtx(), {});

    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
    expect(Object.keys(strictAllowScripts.bindings).sort()).toEqual(['npm']);

    expect(strictAllowScripts.severity).toBe('warn');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['strict-allow-scripts'],
        op: 'setKey',
        value: true,
      },
    ]);
  });

  it('flags a violation when set to false', () => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), { 'strict-allow-scripts': false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});
