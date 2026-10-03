import type { LintOptions } from '../src/index.ts';

export interface Fixture {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly options?: Pick<LintOptions, 'exclude' | 'installationRoots'>;
  readonly expectedScope: { readonly manifests: number; readonly installationRoots: number };
}

const SMALL: Fixture = {
  expectedScope: { manifests: 1, installationRoots: 1 },
  files: {
    '/repo/package.json': JSON.stringify({
      name: 'demo',
      packageManager: 'npm@10.9.0',
    }),
  },
  name: 'small (single package, npm-bad)',
};

const MEDIUM: Fixture = {
  expectedScope: { manifests: 1, installationRoots: 1 },
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

const workspaceEntries = Array.from(
  { length: WORKSPACE_ENTRY_COUNT },
  (_, index) => `  - "packages/p${index}"`,
);
const workspaceYaml = [
  'packages:',
  ...workspaceEntries,
  'strictDepBuilds: true',
  "savePrefix: ''",
  'minimumReleaseAge: 4320',
  'frozenLockfile: true',
  '',
].join('\n');

const WORKSPACE_MANIFEST: Fixture = {
  expectedScope: { manifests: 1, installationRoots: 1 },
  files: {
    '/repo/package.json': JSON.stringify({
      name: 'monorepo-root',
      packageManager: 'pnpm@10.9.0',
      private: true,
    }),
    '/repo/pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    '/repo/pnpm-workspace.yaml': workspaceYaml,
  },
  name: `large workspace config (${WORKSPACE_ENTRY_COUNT} ignored declarations, no child packages)`,
};

const PACKAGE_COUNT = 50;
const packageFiles = Object.fromEntries(
  Array.from({ length: PACKAGE_COUNT }, (_, index) => [
    `/repo/packages/p${index}/package.json`,
    JSON.stringify({ name: `package-${index}`, packageManager: 'npm@12.0.2' }),
  ]),
);
const tree = {
  '/repo/package.json': '{"private":true,"packageManager":"npm@12.0.2"}',
  ...packageFiles,
};
const publication: Fixture = {
  expectedScope: { manifests: PACKAGE_COUNT + 1, installationRoots: 0 },
  name: `${PACKAGE_COUNT} real packages (manifest-only)`,
  files: tree,
  options: { installationRoots: [] },
};
const independent: Fixture = {
  expectedScope: { manifests: PACKAGE_COUNT + 1, installationRoots: 3 },
  name: `${PACKAGE_COUNT} real packages (three installation roots)`,
  files: tree,
  options: { installationRoots: ['.', 'packages/p0', 'packages/p1'] },
};
const excluded: Fixture = {
  expectedScope: { manifests: PACKAGE_COUNT + 1, installationRoots: 0 },
  name: `${PACKAGE_COUNT} real packages (excluded fixture subtree)`,
  files: {
    ...tree,
    ...Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [`/repo/fixtures/p${index}/package.json`, '{']),
    ),
  },
  options: { installationRoots: [], exclude: ['fixtures'] },
};
export const fixtures: readonly Fixture[] = [
  SMALL,
  MEDIUM,
  WORKSPACE_MANIFEST,
  publication,
  independent,
  excluded,
];
