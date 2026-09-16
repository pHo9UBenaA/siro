import { createBuiltinRules } from '../domain/builtin-rules.ts';

/** Read time at evaluation, never at module initialization. */
export const rules = createBuiltinRules({
  now: () => Date.now(),
  parse: (value) => Date.parse(value),
});
