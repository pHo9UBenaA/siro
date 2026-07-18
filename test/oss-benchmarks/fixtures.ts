import type { PM } from '../../src/domain/entities/pms.ts';

export interface OssFixture {
  readonly name: string;
  readonly pm: PM;
  readonly files: Record<string, string>;
}

const eslint: OssFixture = {
  files: {
    '.npmrc': 'package-lock=false\ninstall-links=false\n',
    'package.json': JSON.stringify({
      name: 'eslint',
      packageManager: 'npm@10.9.0',
      version: '9.28.0',
    }),
  },
  name: 'eslint/eslint (npm)',
  pm: 'npm',
};

const svelte: OssFixture = {
  files: {
    'package.json': JSON.stringify({
      name: 'svelte-monorepo',
      packageManager: 'pnpm@10.0.0',
      private: true,
    }),
    'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n  - 'playgrounds/*'\n",
  },
  name: 'sveltejs/svelte (pnpm)',
  pm: 'pnpm',
};

const jestPreSecurity: OssFixture = {
  files: {
    '.yarnrc.yml': [
      'enableGlobalCache: true',
      'enableTelemetry: false',
      'nodeLinker: node-modules',
      '',
    ].join('\n'),
    'package.json': JSON.stringify({
      name: 'jest-monorepo',
      packageManager: 'yarn@4.0.0',
      private: true,
    }),
    'yarn.lock': '# yarn lockfile v1\n',
  },
  name: 'jestjs/jest (yarn, pre-security)',
  pm: 'yarn',
};

const hono: OssFixture = {
  files: {
    'bun.lock': '# bun lockfile\n',
    'bunfig.toml': [
      '[test]',
      'coverage = true',
      'coverageReporter = ["text", "lcov"]',
      'coverageDir = "coverage/raw/bun"',
      '',
    ].join('\n'),
    'package.json': JSON.stringify({
      name: 'hono',
      version: '4.7.0',
    }),
  },
  name: 'honojs/hono (bun)',
  pm: 'bun',
};

const fresh: OssFixture = {
  files: {
    'deno.json': JSON.stringify({
      imports: {
        '@std/cli': 'jsr:@std/cli@^1.0.19',
        '@std/path': 'jsr:@std/path@^1.0.8',
        esbuild: 'npm:esbuild@0.25.7',
      },
      name: '@fresh/core',
      publish: {
        exclude: ['**/*_test.*'],
        include: ['src/**', 'deno.json', 'README.md', 'LICENSE'],
      },
      version: '2.0.0',
    }),
    'deno.lock': '{ "version": "4" }\n',
  },
  name: 'denoland/fresh (deno)',
  pm: 'deno',
};

export const badFixtures = { eslint, fresh, hono, jestPreSecurity, svelte } as const;
