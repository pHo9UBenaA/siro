export const PROJECT_TYPES = ['application', 'package'] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const isProjectType = (value: string): value is ProjectType =>
  PROJECT_TYPES.some((projectType) => projectType === value);
