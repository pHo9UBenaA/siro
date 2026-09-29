import path from 'node:path';
import { pnpmCommand } from '../../scripts/pnpm-command.ts';

it.each(['linux', 'darwin', 'win32'] as const)(
  'uses literal Node argv on %s without a shell',
  (platform) => {
    const entry = path.resolve('space & punctuation/pnpm.cjs');
    expect(pnpmCommand(['audit', '--json'], platform, entry)).toEqual({
      command: process.execPath,
      args: [entry, 'audit', '--json'],
    });
  },
);
it('does not mistake npm for pnpm or launch a Windows cmd shim directly', () => {
  for (const entry of ['', path.resolve('npm-cli.js'), path.resolve('pnpm.cmd')])
    expect(() => pnpmCommand(['audit'], 'win32', entry)).toThrow(/through pnpm/);
  expect(pnpmCommand(['audit'], 'linux', '')).toEqual({ command: 'pnpm', args: ['audit'] });
  const exe = path.resolve('pnpm.exe');
  expect(pnpmCommand(['audit'], 'win32', exe)).toEqual({ command: exe, args: ['audit'] });
});
