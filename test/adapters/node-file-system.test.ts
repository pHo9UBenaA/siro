import { asAbsPath } from '../../src/shared/paths.ts';
import { captureIO } from '../helpers/io.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { lintCommand } from '../../src/application/commands/lint.ts';

vi.setConfig({ testTimeout: 5000 });

const EXIT_SUCCESS = 0;
const EMPTY = 0;

describe('fileSystem abstraction (memfs)', () => {
  it('lint reads through the injected FS and returns 0 for a fully compliant repo', () => {
    expect.hasAssertions();
    // Mirror the npm-good fixture so every error-severity rule is satisfied;
    // a loose `code ∈ {0,1}` assertion would have hidden a regression that
    // started returning 1 for the compliant case.
    const fs = createMemFileSystem({
      '.npmrc': [
        'ignore-scripts=true',
        'save-exact=true',
        "save-prefix=''",
        'provenance=true',
        'min-release-age=7',
        '',
      ].join('\n'),
      'package-lock.json': JSON.stringify({
        lockfileVersion: 3,
        name: 'demo',
        packages: {},
        requires: true,
        version: '1.0.0',
      }),
      'package.json': JSON.stringify({
        files: ['dist'],
        name: 'demo',
        packageManager: 'npm@10.9.0',
        publishConfig: { access: 'public' },
        version: '1.0.0',
      }),
    });
    const { io, out } = captureIO();
    return lintCommand({ cwd: asAbsPath('/repo'), fs, reporter: 'pretty' }, io).then((code) => {
      expect(code).toBe(EXIT_SUCCESS);
      expect(out().length).toBeGreaterThan(EMPTY);
    });
  });
});
