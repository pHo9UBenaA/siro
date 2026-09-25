import type { WorkspaceGlobOptions } from '../core/contracts/workspace-glob.ts';

export const workspaceGlobOptions = (
  caseInsensitive: boolean,
): Extract<WorkspaceGlobOptions, { kind: 'directory' }> => ({
  kind: 'directory',
  syntax: 'shell',
  caseInsensitive,
});
