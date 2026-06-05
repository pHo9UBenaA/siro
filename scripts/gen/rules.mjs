#!/usr/bin/env node
import { createScriptContext } from '../_shared/script-runtime.mjs';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const ctx = createScriptContext(import.meta.url);
try {
  const { renderRulesDoc } = await ctx.loadLib('scripts/gen/lib/doc-generator.ts');
  writeFileSync(path.join(ctx.root, 'docs/rules.md'), renderRulesDoc());
  ctx.logSuccess('docs/rules.md regenerated.');
} catch (error) {
  ctx.fail(error);
}
