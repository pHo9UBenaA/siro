#!/usr/bin/env node
// Run the lint bench harness. The harness is a top-level-await ESM module
// that calls `bench.run()` at import time and prints results before its
// `loadLib` promise resolves.
import { createScriptContext } from '../_shared/script-runtime.mjs';

const ctx = createScriptContext(import.meta.url);

try {
  await ctx.loadLib('bench/lint.bench.ts');
} catch (error) {
  ctx.fail(error);
}
