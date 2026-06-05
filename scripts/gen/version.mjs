#!/usr/bin/env node
// Generates src/version.ts from package.json so the CLI never drifts.
import { createScriptContext } from '../_shared/script-runtime.mjs';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const ctx = createScriptContext(import.meta.url);
try {
  const { readPackageVersion, renderVersionModule } = await ctx.loadLib(
    'scripts/gen/lib/version.ts',
  );
  const version = readPackageVersion(ctx.root);
  writeFileSync(path.join(ctx.root, 'src', 'version.ts'), renderVersionModule(version));
  ctx.logSuccess('src/version.ts regenerated.');
} catch (error) {
  ctx.fail(error);
}
