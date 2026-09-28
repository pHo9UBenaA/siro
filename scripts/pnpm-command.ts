import path from 'node:path';

/** Use the invoking pnpm entry, not a .cmd shell shim or npm's different CLI. */
export const pnpmCommand = (
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  entry = process.env.npm_execpath,
): { command: string; args: string[] } => {
  if (entry && path.isAbsolute(entry)) {
    if (/^pnpm\.(?:c?js|mjs)$/iu.test(path.basename(entry)))
      return { command: process.execPath, args: [entry, ...args] };
    if (platform === 'win32' && path.basename(entry).toLowerCase() === 'pnpm.exe')
      return { command: entry, args: [...args] };
  }
  if (platform === 'win32')
    throw new Error(
      'Run this script through pnpm so its executable entry is available (not npm or a bare .cmd shim).',
    );
  return { command: 'pnpm', args: [...args] };
};
