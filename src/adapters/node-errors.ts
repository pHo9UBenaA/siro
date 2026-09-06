/** Only the Error and code properties are established by this guard. */
export const isNodeError = (value: unknown): value is Error & { code: string } =>
  value instanceof Error && 'code' in value && typeof value.code === 'string';
