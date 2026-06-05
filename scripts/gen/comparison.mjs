#!/usr/bin/env node
// Regenerates docs/comparison.md from the rule registry.
import { createScriptContext } from '../_shared/script-runtime.mjs';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const ctx = createScriptContext(import.meta.url);
try {
  const { renderComparison } = await ctx.loadLib('scripts/gen/lib/doc-generator.ts');
  writeFileSync(path.join(ctx.root, 'docs/comparison.md'), renderComparison());
  ctx.logSuccess('docs/comparison.md regenerated.');
} catch (error) {
  ctx.fail(error);
}
