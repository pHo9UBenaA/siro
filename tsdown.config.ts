import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: { entry: ['src/index.ts'] },
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  minify: false,
  sourcemap: true,
  target: 'node20',
});
