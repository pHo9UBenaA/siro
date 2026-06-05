/**
 * Canonical list of siro CLI sub-commands. Shared between `cli.ts` (the
 * dispatcher / arg parser) and `cli/help.ts` (the help-text renderer) so a
 * new command added here propagates to both via the derived `CommandName`
 * union — there is no second place to remember to update.
 */
export const COMMANDS = ['lint', 'check'] as const;

export type CommandName = (typeof COMMANDS)[number];

export const isCommandName = (value: string): value is CommandName =>
  COMMANDS.some((cmd) => cmd === value);
