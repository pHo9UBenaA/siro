import { captureIO } from './helpers/io.ts';
import path from 'node:path';
import { run } from '../src/cli.ts';

vi.setConfig({ testTimeout: 5000 });

const EXIT_SUCCESS = 0;

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

describe('bun end-to-end (toml codec)', () => {
  it('lints a fully compliant bun repo with only the bun-security-scanner advisory (exit 0)', () => {
    expect.hasAssertions();
    const { io, out } = captureIO();
    return run(['lint', path.join(FIXTURES, 'bun-good')], io).then((code) => {
      expect(code).toBe(EXIT_SUCCESS);
      expect(out()).toContain('bun-security-scanner');
    });
  });
});
