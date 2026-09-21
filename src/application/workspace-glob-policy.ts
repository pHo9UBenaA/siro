import type { WorkspaceGlobOptions } from './ports/workspace-glob.ts';

export const workspaceGlobOptions = (
  caseInsensitive: boolean,
): Extract<WorkspaceGlobOptions, { kind: 'directory' }> => ({
  kind: 'directory',
  syntax: 'shell',
  caseInsensitive,
});
