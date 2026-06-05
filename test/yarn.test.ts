import { captureIO } from './helpers/io.ts';
import path from 'node:path';
import { run } from '../src/cli.ts';

vi.setConfig({ testTimeout: 5000 });

const EXIT_SUCCESS = 0;

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

describe('yarn end-to-end (yaml codec)', () => {
  it('lints a fully compliant yarn repo as clean (exit 0)', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    return run(['lint', path.join(FIXTURES, 'yarn-good')], io).then((code) => {
      expect(code).toBe(EXIT_SUCCESS);
      // See lint.test.ts: keep the success phrase regex aligned with the
      // reporter contract so prose tweaks don't ripple across PM tests.
      expect(out()).toMatch(/no .+(?<kind>issues|findings|problems)/iu);
    });
  });
});
