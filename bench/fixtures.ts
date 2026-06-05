export interface Fixture {
  readonly name: string;
  readonly files: Record<string, string>;
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

const MONOREPO_PACKAGE_COUNT = 50;

const buildMonorepo = (): Fixture => {
  const files: Record<string, string> = {
    '/repo/package.json': JSON.stringify({
      name: 'monorepo-root',
      packageManager: 'pnpm@10.9.0',
      private: true,
    }),
    '/repo/pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    '/repo/pnpm-workspace.yaml': `packages:\n${Array.from(
      { length: MONOREPO_PACKAGE_COUNT },
      (_unused, idx) => `  - "packages/p${idx}"`,
    ).join(
      '\n',
    )}\nstrictDepBuilds: true\nsavePrefix: ''\nminimumReleaseAge: 4320\nfrozenLockfile: true\n`,
  };
  const FIRST_IDX = 0;
  const STEP = 1;
  for (let idx = FIRST_IDX; idx < MONOREPO_PACKAGE_COUNT; idx += STEP) {
    files[`/repo/packages/p${idx}/package.json`] = JSON.stringify({
      name: `@demo/p${idx}`,
      version: '1.0.0',
    });
  }
  return { files, name: `monorepo (${MONOREPO_PACKAGE_COUNT} packages, pnpm)` };
};

const MONOREPO: Fixture = buildMonorepo();

export const fixtures: readonly Fixture[] = [SMALL, MEDIUM, MONOREPO];
