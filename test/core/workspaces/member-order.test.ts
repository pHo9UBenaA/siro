import { asAbsPath, ConfigError, lint } from '../../../src/index.ts';
import { createMemFileSystem } from '../../helpers/memfs.ts';

const root = asAbsPath('/repo');
const posix = (path: string) => path.replaceAll('\\', '/');

it('validates both Deno declaration sources before walking the first source', () => {
  const readDirectories = vi.fn<() => readonly string[]>(() => {
    throw new Error('Walk must not start');
  });
  expect(() =>
    lint({
      cwd: root,
      pm: 'deno',
      workspaces: true,
      fs: {
        ...createMemFileSystem({
          'deno.json': '{"workspace":["child"]}',
          'package.json': '{"workspaces":"invalid"}',
        }),
        readDirectories,
      },
    }),
  ).toThrow('package.json#workspaces: expected an array of directory patterns.');
  expect(readDirectories).not.toHaveBeenCalled();
});

it('finishes directory discovery before reading any candidate manifest', () => {
  const source = createMemFileSystem({
    'package.json': '{"private":true,"workspaces":["**"]}',
    'a/package.json': '{',
  });
  const failure = new Error('Directory b cannot be read');
  const events: string[] = [];
  let caught: unknown;
  try {
    lint({
      cwd: root,
      pm: 'npm',
      workspaces: true,
      fs: {
        ...source,
        readText(file) {
          events.push(`read:${posix(file)}`);
          return source.readText(file);
        },
        readDirectories(directory) {
          events.push(`walk:${posix(directory)}`);
          if (posix(directory) === '/repo') return ['a', 'b'];
          if (posix(directory) === '/repo/b') throw failure;
          return [];
        },
      },
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(events).toEqual(['read:/repo/package.json', 'walk:/repo', 'walk:/repo/b']);
});

it('validates candidate manifests in sorted order, not enumeration or declaration order', () => {
  const source = createMemFileSystem({
    'package.json': '{"private":true,"workspaces":["b","a"]}',
    'a/package.json': '{',
    'b/package.json': '{',
  });
  const reads: string[] = [];
  let caught: unknown;
  try {
    lint({
      cwd: root,
      pm: 'npm',
      workspaces: true,
      fs: {
        ...source,
        readText(file) {
          reads.push(posix(file));
          return source.readText(file);
        },
        readDirectories: (directory) => (posix(directory) === '/repo' ? ['b', 'a'] : []),
      },
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ConfigError);
  expect((caught as ConfigError).message).toMatch(/^a\/package.json: invalid JSON/u);
  expect(reads).toEqual(['/repo/package.json', '/repo/a/package.json']);
});

it('does not inspect declarations or children when workspaces are disabled', () => {
  const source = createMemFileSystem({
    'package.json': '{"private":true,"workspaces":"invalid"}',
  });
  const readDirectories = vi.fn<() => readonly string[]>(() => {
    throw new Error('No workspace discovery');
  });
  const result = lint({
    cwd: root,
    pm: 'npm',
    workspaces: false,
    fs: {
      ...source,
      readText(file) {
        if (posix(file).startsWith('/repo/child/')) throw new Error('No child reads');
        return source.readText(file);
      },
      readDirectories,
    },
  });
  expect(result.findings.every(({ file }) => !file?.startsWith('child/'))).toBe(true);
  expect(readDirectories).not.toHaveBeenCalled();
});
