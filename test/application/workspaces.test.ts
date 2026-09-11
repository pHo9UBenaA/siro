import {
  asAbsPath,
  lint,
  type LintOptions,
  ConfigError,
  UsageError,
  type FileSystem,
  type PM,
} from '../../src/index.ts';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMemFileSystem } from '../helpers/memfs.ts';

const posix = (value: string) => value.replaceAll('\\', '/');

const repo = (options: Partial<LintOptions> = {}) =>
  lint({
    cwd: asAbsPath('/repo'),
    fs: {
      ...createMemFileSystem({
        'package.json': JSON.stringify({
          private: true,
          packageManager: 'npm@9.4.2',
          workspaces: ['packages/*', '!packages/excluded'],
        }),
        'packages/public/package.json': JSON.stringify({
          name: 'public-child',
          packageManager: 'npm@12.0.2',
          publishConfig: { provenance: true },
        }),
        'packages/internal/package.json': '{"name":"internal","private":true}',
        'packages/excluded/package.json': 'invalid JSON',
        'unrelated/package.json': 'invalid JSON',
      }),
      readDirectories: (dir) =>
        new Map<string, string[]>([
          ['/repo', ['packages', 'unrelated']],
          ['/repo/packages', ['public', 'internal', 'excluded']],
        ]).get(posix(dir)) ?? [],
    },
    ...options,
  });

it('finds public children of a private workspace root without demanding child install settings', () => {
  const result = repo({ workspaces: true });
  expect(
    result.findings
      .filter((finding) => finding.file?.startsWith('packages/'))
      .map(({ ruleId, file }) => ({ ruleId, file })),
  ).toEqual([
    { ruleId: 'files-field', file: 'packages/public/package.json' },
    { ruleId: 'publish-access', file: 'packages/public/package.json' },
    { ruleId: 'unsupported-settings', file: 'packages/public/package.json' },
  ]);
});

it('keeps the aggregated summary consistent with the findings', () => {
  const result = repo({ workspaces: true });
  for (const severity of ['error', 'warn', 'info'] as const) {
    expect(result.summary[severity]).toBe(
      result.findings.filter((finding) => finding.severity === severity).length,
    );
  }
});

it('requires injected directory discovery instead of falling back to host IO', () => {
  expect(() =>
    repo({
      workspaces: true,
      fs: createMemFileSystem({
        'package.json': '{"packageManager":"npm@11.10.0","workspaces":["packages/*"]}',
      }),
    }),
  ).toThrow(UsageError);
});

it('does not open unrelated subdirectories for a fixed-depth declaration', () => {
  const visited: string[] = [];
  const fs = createMemFileSystem({
    'package.json': '{"packageManager":"npm@11.10.0","workspaces":["././packages/*/"]}',
    'packages/a/package.json': '{"name":"a"}',
  });
  const result = repo({
    workspaces: true,
    fs: {
      ...fs,
      readDirectories: (directory) => {
        visited.push(posix(directory));
        if (posix(directory) === '/repo') return ['packages', 'unrelated'];
        if (posix(directory) === '/repo/packages') return ['a'];
        throw new Error('Unexpected directory access');
      },
    },
  });
  expect(result.findings.some((finding) => finding.file === 'packages/a/package.json')).toBe(true);
  expect(visited).toEqual(['/repo', '/repo/packages']);
});

it('propagates directory read errors and rejects invalid adapter output', () => {
  const fs = createMemFileSystem({
    'package.json': '{"packageManager":"npm@11.10.0","workspaces":["*"]}',
  });
  const failure = new Error('EACCES: directory unreadable');
  expect(() =>
    repo({
      workspaces: true,
      fs: {
        ...fs,
        readDirectories: () => {
          throw failure;
        },
      },
    }),
  ).toThrow(failure);
  for (const names of [null, ['..'], ['x/y'], ['C:outside'], [0]]) {
    expect(() =>
      repo({ workspaces: true, fs: { ...fs, readDirectories: () => names } as FileSystem }),
    ).toThrow(ConfigError);
  }
});

it.each(['tools/**', 'tools/deep/member'])(
  'does not extend a fixed member traversal because of %s',
  (otherPattern) => {
    const fs = createMemFileSystem({
      'package.json': JSON.stringify({ private: true, workspaces: ['packages/a', otherPattern] }),
      'packages/a/package.json': '{"name":"a"}',
      'tools/deep/member/package.json': '{"name":"tool"}',
    });
    const failure = new Error('EACCES: member contents cannot be listed');
    const readDirectories = (directory: string) => {
      const entries = new Map([
        ['/repo', ['packages', 'tools']],
        ['/repo/packages', ['a']],
        ['/repo/tools', ['deep']],
        ['/repo/tools/deep', ['member']],
        ['/repo/tools/deep/member', []],
      ]);
      if (posix(directory) === '/repo/packages/a') throw failure;
      return entries.get(posix(directory)) ?? [];
    };
    const options = { pm: 'npm' as const, workspaces: true, fs: { ...fs, readDirectories } };
    expect(
      repo(options)
        .findings.filter((finding) => finding.ruleId === 'files-field')
        .map((finding) => finding.file),
    ).toEqual(['packages/a/package.json', 'tools/deep/member/package.json']);
    const recursive = createMemFileSystem({
      'package.json': '{"private":true,"workspaces":["packages/**"]}',
      'packages/a/package.json': '{"name":"a"}',
    });
    expect(() => repo({ ...options, fs: { ...recursive, readDirectories } })).toThrow(failure);
  },
);

it('rejects a non-boolean workspace option', () => {
  expect(() => repo({ workspaces: 'yes' } as unknown as LintOptions)).toThrow(UsageError);
});

it.each(['npm', 'pnpm'] satisfies PM[])(
  'reports un-compilable %s patterns as configuration errors',
  (pm) => {
    const pattern = 'a'.repeat(65_537);
    expect(() =>
      repo({
        pm,
        workspaces: true,
        fs: {
          ...createMemFileSystem({
            'package.json': JSON.stringify({ private: true, workspaces: [pattern] }),
            'pnpm-workspace.yaml': JSON.stringify({ packages: [pattern] }),
          }),
          readDirectories: () => [],
        },
      }),
    ).toThrow(ConfigError);
  },
);

it.each(['packages/a*/child', 'packages/{alpha/child,other/**}'])(
  'does not list directories ruled out by intermediate glob segments: %s',
  (pattern) => {
    const fs = createMemFileSystem({
      'package.json': JSON.stringify({ private: true, workspaces: [pattern] }),
      'packages/alpha/child/package.json': '{"name":"child"}',
    });
    const directories = new Map([
      ['/repo', ['packages']],
      ['/repo/packages', ['alpha', 'beta']],
      ['/repo/packages/alpha', ['child']],
    ]);
    const result = repo({
      pm: 'npm',
      workspaces: true,
      fs: {
        ...fs,
        readDirectories(directory) {
          const names = directories.get(posix(directory));
          if (!names) throw new Error(`EACCES: unnecessary directory read ${directory}`);
          return names;
        },
      },
    });
    expect(
      result.findings
        .filter((finding) => finding.ruleId === 'files-field')
        .map((finding) => finding.file),
    ).toEqual(['packages/alpha/child/package.json']);
  },
);

it.each([
  ['packages/{1..12}/child', ['packages/3/child', 'packages/12/child']],
  ['packages/{01..03}/child', ['packages/02/child']],
  ['packages/{1..9..2}/child', ['packages/3/child']],
  [
    'packages/{alpha/{child,deep/member},other/**}',
    ['packages/alpha/child', 'packages/alpha/deep/member'],
  ],
  ['packages/**/child', ['packages/child', 'packages/alpha/child']],
  ['packages/**/**/child', ['packages/child', 'packages/alpha/child']],
  ['packages/.hidden/*/child', ['packages/.hidden/alpha/child']],
  ['packages/a(b)/child', ['packages/a(b)/child']],
  ['packages/@(alpha|beta)/child', ['packages/alpha/child']],
  ['packages/{,alpha}/child/grand', ['packages/child/grand']],
  ['packages/{.,alpha}/child/grand', ['packages/child/grand']],
  ['packages/{{**,alpha},beta}/child/grand', ['packages/x/y/child/grand']],
] as const)('preserves member discovery through %s', (pattern, members) => {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ private: true, workspaces: [pattern] }),
  };
  for (const member of members) files[`${member}/package.json`] = '{"name":"member"}';
  const directories = new Map<string, Set<string>>();
  for (const member of members) {
    let parent = '/repo';
    for (const name of member.split('/')) {
      if (!directories.has(parent)) directories.set(parent, new Set());
      directories.get(parent)!.add(name);
      parent += `/${name}`;
    }
  }
  const result = repo({
    pm: 'npm',
    workspaces: true,
    fs: {
      ...createMemFileSystem(files),
      readDirectories: (directory) => [...(directories.get(posix(directory)) ?? [])],
    },
  });
  expect(
    result.findings
      .filter((finding) => finding.ruleId === 'files-field')
      .map((finding) => finding.file),
  ).toEqual(members.map((member) => `${member}/package.json`).sort());
});

it('accepts brace lists beyond the former custom expansion limit', () => {
  const readDirectories = vi.fn<NonNullable<FileSystem['readDirectories']>>(() => []);
  expect(() =>
    repo({
      pm: 'npm',
      workspaces: true,
      fs: {
        ...createMemFileSystem({
          'package.json': JSON.stringify({
            workspaces: [`{${Array.from({ length: 4097 }, (_, i) => `p${i}`).join(',')}}/child`],
          }),
        }),
        readDirectories,
      },
    }),
  ).not.toThrow();
  expect(readDirectories).toHaveBeenCalledOnce();
});

describe('native workspace discovery', () => {
  let root: string;
  const put = (file: string, value: unknown) => {
    const destination = path.join(root, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const check = (pm: PM = 'npm') => lint({ cwd: asAbsPath(root), pm, workspaces: true });
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'siro-workspaces-'));
    put('package.json', {
      private: true,
      packageManager: 'npm@11.10.0',
      workspaces: ['packages/**', 'packages/a', '!**/excluded/**'],
    });
    put('packages/a/package.json', { name: 'a' });
    put('packages/deep/b/package.json', { name: 'b' });
    put('packages/excluded/package.json', 'invalid JSON');
    put('packages/node_modules/dep/package.json', 'invalid JSON');
    put('packages/.git/hidden/package.json', 'invalid JSON');
    put('unrelated/package.json', 'invalid JSON');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it.each(['npm', 'yarn', 'bun'] satisfies PM[])(
    'reads %s declarations with exclusions, deduplication, and nested globs',
    (pm) => {
      expect(
        check(pm)
          .findings.filter((finding) => finding.ruleId === 'files-field')
          .map((finding) => finding.file),
      ).toEqual(['packages/a/package.json', 'packages/deep/b/package.json']);
    },
  );

  it('uses pnpm packages rather than package.json workspaces', () => {
    put('pnpm-workspace.yaml', "packages:\n  - 'packages/a'\n");
    expect(
      check('pnpm')
        .findings.filter((finding) => finding.ruleId === 'files-field')
        .map((finding) => finding.file),
    ).toEqual(['packages/a/package.json']);
  });

  it.each([
    { patterns: ['packages/**', '!packages/b/**', 'packages/b/a'], expected: ['a', 'c'] },
    {
      patterns: ['packages/**', '!packages/b/**', '!packages/b/**', 'packages/b/a'],
      expected: ['a', 'c'],
    },
    { patterns: ['packages/**', 'packages/b/a', '!packages/b/**'], expected: [] },
    { patterns: ['packages/**', '!packages/b/**', 'packages/a'], expected: [] },
  ])('honors npm ordered exclusion cancellation: $patterns', ({ patterns, expected }) => {
    put('package.json', { private: true, workspaces: [...patterns, '!packages/excluded/**'] });
    put('packages/b/a/package.json', { name: 'reintroduced-a' });
    put('packages/b/c/package.json', { name: 'reintroduced-c' });
    expect(
      check('npm')
        .findings.filter(
          (finding) => finding.ruleId === 'files-field' && finding.file?.startsWith('packages/b/'),
        )
        .map((finding) => finding.file),
    ).toEqual(expected.map((name) => `packages/b/${name}/package.json`));
  });

  it('preserves exclusion priority for pnpm declarations', () => {
    put('pnpm-workspace.yaml', {
      packages: ['packages/**', '!packages/b/**', 'packages/b/a', '!packages/excluded/**'],
    });
    put('packages/b/a/package.json', { name: 'excluded' });
    expect(check('pnpm').findings.some((finding) => finding.file?.startsWith('packages/b/'))).toBe(
      false,
    );
  });

  it('uses npm case-sensitive pattern comparison when cancelling exclusions', () => {
    put('package.json', {
      private: true,
      workspaces: ['PACKAGES/**', '!PACKAGES/B/**', 'packages/b/a', '!packages/excluded/**'],
    });
    put('PACKAGES/B/a/package.json', { name: 'excluded' });
    expect(
      check('npm').findings.some((finding) => /^packages\/b\//iu.test(finding.file ?? '')),
    ).toBe(false);
  });

  it('supports the packages object and brace patterns', () => {
    put('package.json', { private: true, workspaces: { packages: ['packages/{a,deep/b}'] } });
    expect(check().findings.filter((finding) => finding.ruleId === 'files-field')).toHaveLength(2);
  });

  it('checks separate declarations for each selected PM without leaking members between managers', () => {
    put('pnpm-workspace.yaml', "packages:\n  - 'packages/a'\n");
    const result = lint({ cwd: asAbsPath(root), workspaces: true });
    expect(
      result.findings
        .filter((finding) => finding.ruleId === 'files-field')
        .map(({ pm, file }) => `${pm}:${file}`),
    ).toEqual([
      'npm:packages/a/package.json',
      'npm:packages/deep/b/package.json',
      'pnpm:packages/a/package.json',
    ]);
  });

  it('does not recurse into directory symlinks', () => {
    symlinkSync(
      path.join(root, 'unrelated'),
      path.join(root, 'packages', 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(check().findings.some((finding) => finding.file?.includes('linked'))).toBe(false);
  });

  it('uses platform case matching for literal workspace segments and exclusions', () => {
    put('package.json', {
      private: true,
      workspaces: ['PACKAGES/A', 'PACKAGES/DEEP/*', '!PACKAGES/DEEP/B'],
    });
    const expected =
      process.platform === 'darwin' || process.platform === 'win32'
        ? ['packages/a/package.json']
        : [];
    expect(
      check()
        .findings.filter((finding) => finding.ruleId === 'files-field')
        .map((finding) => finding.file),
    ).toEqual(expected);
  });

  it('reports the selected child path on invalid JSON or manifest types', () => {
    for (const bad of ['{', '{"files":false}']) {
      put('packages/a/package.json', bad);
      expect(() => check()).toThrow(/packages\/a\/package.json/u);
    }
  });

  it('does not load child executable configs or validate child installation configs', () => {
    put('packages/a/siro.config.mjs', 'throw new Error("must not execute")');
    put('packages/a/.npmrc', 'ignore-scripts=false');
    put('packages/a/pnpm-workspace.yaml', '[');
    expect(
      check()
        .findings.filter((finding) => finding.file?.startsWith('packages/a/'))
        .map((finding) => finding.ruleId),
    ).toEqual(['files-field', 'publish-access']);
  });

  it('honors an explicit project type without inheriting root private metadata', () => {
    expect(
      lint({
        cwd: asAbsPath(root),
        pm: 'npm',
        workspaces: true,
        projectType: 'application',
      }).findings.some((finding) => finding.ruleId === 'files-field'),
    ).toBe(false);
  });

  it.each(
    [
      ['../outside'],
      ['/tmp/*'],
      ['packages/../../*'],
      ['C:\\*'],
      ['!'],
      'packages/*',
      [null],
      { nope: [] },
    ].map((workspaces) => ({ workspaces })),
  )('rejects malformed or escaping declarations: $workspaces', ({ workspaces }) => {
    put('package.json', { private: true, workspaces });
    expect(() => check()).toThrow(ConfigError);
  });

  it('treats omitted pnpm packages as root only', () => {
    put('pnpm-workspace.yaml', 'strictDepBuilds: true');
    expect(check('pnpm').findings.some((finding) => finding.file?.includes('/package.json'))).toBe(
      false,
    );
  });

  it('does not treat the root itself as a child and permits no matching members', () => {
    put('package.json', { private: true, workspaces: ['.', 'missing/*'] });
    expect(check().findings.some((finding) => finding.file?.includes('/package.json'))).toBe(false);
  });

  it.each(['deno', 'aube'] satisfies PM[])(
    'permits a root without member declarations for %s',
    (pm) => {
      put('package.json', { private: true });
      expect(() => check(pm)).not.toThrow();
    },
  );
});

it('preserves the default single-root inspection', () => {
  expect(repo().findings.some((finding) => finding.file?.startsWith('packages/'))).toBe(false);
});

it('honors the root target override and per-rule severity', () => {
  const result = repo({
    workspaces: true,
    pm: 'npm',
    pmVersion: '11.10.0',
    config: { rules: { 'files-field': 'error', 'publish-access': 'off' } },
  });
  expect(result.findings.filter((finding) => finding.file?.startsWith('packages/'))).toEqual([
    expect.objectContaining({
      ruleId: 'files-field',
      severity: 'error',
      file: 'packages/public/package.json',
    }),
  ]);
});
