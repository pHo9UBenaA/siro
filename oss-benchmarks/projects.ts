import type { CodecKind } from '../src/domain/entities/config-value.ts';

export interface OssProject {
  readonly name: string;
  readonly repo: string;
  readonly branch: string;
  readonly configFiles: readonly { readonly path: string; readonly codecKind: CodecKind }[];
}

export const projects: readonly OssProject[] = [
  {
    branch: 'main',
    configFiles: [{ codecKind: 'npmrc', path: '.npmrc' }],
    name: 'nodejs/node',
    repo: 'nodejs/node',
  },
  {
    branch: 'master',
    configFiles: [{ codecKind: 'npmrc', path: '.npmrc' }],
    name: 'expressjs/express',
    repo: 'expressjs/express',
  },
  {
    branch: 'trunk',
    configFiles: [{ codecKind: 'npmrc', path: '.npmrc' }],
    name: 'WordPress/gutenberg',
    repo: 'WordPress/gutenberg',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'npmrc', path: '.npmrc' }],
    name: 'BerriAI/litellm',
    repo: 'BerriAI/litellm',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'npmrc', path: '.npmrc' }],
    name: 'fastify/fastify',
    repo: 'fastify/fastify',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'withastro/astro',
    repo: 'withastro/astro',
  },
  {
    branch: 'canary',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'vercel/next.js',
    repo: 'vercel/next.js',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'clerk/javascript',
    repo: 'clerk/javascript',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'web-infra-dev/rspack',
    repo: 'web-infra-dev/rspack',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'vitejs/vite',
    repo: 'vitejs/vite',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'vuejs/core',
    repo: 'vuejs/core',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'biomejs/biome',
    repo: 'biomejs/biome',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'nuxt/nuxt',
    repo: 'nuxt/nuxt',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'TanStack/query',
    repo: 'TanStack/query',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'angular/angular',
    repo: 'angular/angular',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'vitest-dev/vitest',
    repo: 'vitest-dev/vitest',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'oxc-project/oxc',
    repo: 'oxc-project/oxc',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'rolldown/rolldown',
    repo: 'rolldown/rolldown',
  },
  {
    branch: 'master',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'nrwl/nx',
    repo: 'nrwl/nx',
  },
  {
    branch: 'master',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'supabase/supabase',
    repo: 'supabase/supabase',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'pnpm-workspace.yaml' }],
    name: 'tailwindlabs/tailwindcss',
    repo: 'tailwindlabs/tailwindcss',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: '.yarnrc.yml' }],
    name: 'docker/actions-toolkit',
    repo: 'docker/actions-toolkit',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: '.yarnrc.yml' }],
    name: 'MetaMask/metamask-extension',
    repo: 'MetaMask/metamask-extension',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: '.yarnrc.yml' }],
    name: 'electron/electron',
    repo: 'electron/electron',
  },
  {
    branch: 'dev',
    configFiles: [{ codecKind: 'yaml', path: '.yarnrc.yml' }],
    name: 'laurent22/joplin',
    repo: 'laurent22/joplin',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: '.yarnrc.yml' }],
    name: 'MetaMask/snaps',
    repo: 'MetaMask/snaps',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: '.yarnrc.yml' }],
    name: 'babel/babel',
    repo: 'babel/babel',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'toml', path: 'bunfig.toml' }],
    name: 'oven-sh/bun',
    repo: 'oven-sh/bun',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'toml', path: 'bunfig.toml' }],
    name: 'Uniswap/interface',
    repo: 'Uniswap/interface',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'toml', path: 'bunfig.toml' }],
    name: 'OpenCut-app/OpenCut',
    repo: 'OpenCut-app/OpenCut',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'toml', path: 'bunfig.toml' }],
    name: 'kaito-project/airunway',
    repo: 'kaito-project/airunway',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'toml', path: 'bunfig.toml' }],
    name: 'vendurehq/community-plugins',
    repo: 'vendurehq/community-plugins',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'toml', path: 'bunfig.toml' }],
    name: 'osmlab/osm-auth',
    repo: 'osmlab/osm-auth',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'json', path: 'deno.json' }],
    name: 'yt-dlp/ejs',
    repo: 'yt-dlp/ejs',
  },
  {
    branch: 'master',
    configFiles: [{ codecKind: 'json', path: 'deno.json' }],
    name: 'denodrivers/redis',
    repo: 'denodrivers/redis',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'json', path: 'deno.json' }],
    name: 'oakserver/oak',
    repo: 'oakserver/oak',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'json', path: 'deno.jsonc' }],
    name: 'denoland/dnt',
    repo: 'denoland/dnt',
  },
  {
    branch: 'master',
    configFiles: [{ codecKind: 'json', path: 'deno.json' }],
    name: 'hexagon/croner',
    repo: 'hexagon/croner',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'json', path: 'deno.json' }],
    name: 'denoland/fresh',
    repo: 'denoland/fresh',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'json', path: 'deno.json' }],
    name: 'denoland/std',
    repo: 'denoland/std',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'aube-workspace.yaml' }],
    name: 'yoziru/nextjs-vllm-ui',
    repo: 'yoziru/nextjs-vllm-ui',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'aube-workspace.yaml' }],
    name: 'craftlions/uppy',
    repo: 'craftlions/uppy',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'aube-workspace.yaml' }],
    name: 'radiosilence/blit',
    repo: 'radiosilence/blit',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'aube-workspace.yaml' }],
    name: 'craftlions/website',
    repo: 'craftlions/website',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'aube-workspace.yaml' }],
    name: 'radiosilence/jaritanet',
    repo: 'radiosilence/jaritanet',
  },
  {
    branch: 'master',
    configFiles: [{ codecKind: 'yaml', path: 'aube-workspace.yaml' }],
    name: 'leuchtturm-dev/leuchtturm',
    repo: 'leuchtturm-dev/leuchtturm',
  },
  {
    branch: 'master',
    configFiles: [{ codecKind: 'yaml', path: 'aube-workspace.yaml' }],
    name: 'dkarter/dotfiles',
    repo: 'dkarter/dotfiles',
  },
  {
    branch: 'main',
    configFiles: [{ codecKind: 'yaml', path: 'aube-workspace.yaml' }],
    name: 'johnsyweb/parkrun-by-public-transport',
    repo: 'johnsyweb/parkrun-by-public-transport',
  },
];
