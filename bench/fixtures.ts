export interface Fixture {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
}

const SMALL: Fixture = {
  files: {
    '/repo/package.json': JSON.stringify({
      name: 'demo',
      packageManager: 'npm@10.9.0',
    }),
  },
  name: 'small (single package, npm-bad)',
};

const MEDIUM: Fixture = {
  files: {
    '/repo/.npmrc': [
      'ignore-scripts=true',
      'save-exact=true',
      'provenance=true',
      'min-release-age=3',
      '',
    ].join('\n'),
    '/repo/package.json': JSON.stringify({
      files: ['dist'],
      name: 'demo',
      packageManager: 'pnpm@10.9.0',
      publishConfig: { access: 'public' },
      scripts: { build: 'tsdown', test: 'vitest run' },
      version: '1.2.3',
    }),
    '/repo/pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    '/repo/pnpm-workspace.yaml': `# pnpm workspace settings
strictDepBuilds: true
savePrefix: ''
minimumReleaseAge: 4320
frozenLockfile: true
`,
  },
  name: 'medium (single package, full configs, mixed compliance)',
};

const WORKSPACE_ENTRY_COUNT = 50;

const WORKSPACE_MANIFEST: Fixture = {
  files: {
    '/repo/package.json': JSON.stringify({
      name: 'monorepo-root',
      packageManager: 'pnpm@10.9.0',
      private: true,
    }),
    '/repo/pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    '/repo/pnpm-workspace.yaml': `packages:\n${Array.from(
      { length: WORKSPACE_ENTRY_COUNT },
      (_unused, idx) => `  - "packages/p${idx}"`,
    ).join(
      '\n',
    )}\nstrictDepBuilds: true\nsavePrefix: ''\nminimumReleaseAge: 4320\nfrozenLockfile: true\n`,
  },
  name: `workspace manifest (${WORKSPACE_ENTRY_COUNT} entries, pnpm)`,
};

export const fixtures = [SMALL, MEDIUM, WORKSPACE_MANIFEST] as const satisfies readonly Fixture[];
