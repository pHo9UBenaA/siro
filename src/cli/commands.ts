const COMMANDS = ['lint', 'check'] as const;

export type CommandName = (typeof COMMANDS)[number];

export const isCommandName = (value: string): value is CommandName =>
  COMMANDS.some((cmd) => cmd === value);
