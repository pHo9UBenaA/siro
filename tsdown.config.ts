import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: { entry: ['src/index.ts'] },
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  // Compact distribution files without renaming functions or rewriting control flow.
  minify: { compress: false, mangle: false, codegen: { legalComments: 'inline' } },
  sourcemap: true,
  target: 'node22',
});
