import type { WorkspaceGlobOptions } from './ports/workspace-glob.ts';

export const workspaceGlobOptions = (caseInsensitive: boolean): WorkspaceGlobOptions => ({
  platform: 'linux',
  nocase: caseInsensitive,
  windowsPathsNoEscape: true,
  nonegate: true,
  nocomment: true,
  optimizationLevel: 2,
});
