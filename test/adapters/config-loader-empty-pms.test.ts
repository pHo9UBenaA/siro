import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { asAbsPath } from '../../src/shared/paths.ts';
import { loadConfig } from '../../src/adapters/config-loader.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

describe('loadConfig rejects an empty pms array', () => {
  let dir = '';
  afterEach(() => {
    if (dir !== '') {
      rmSync(dir, { force: true, recursive: true });
    }
    dir = '';
  });

  it('throws a ConfigError naming the empty pms key', () => {
    expect.hasAssertions();
    dir = mkdtempSync(path.join(tmpdir(), 'siro-empty-pms-'));
    writeFileSync(path.join(dir, 'siro.config.mjs'), 'export default { pms: [] };\n');
    return expect(loadConfig(asAbsPath(dir))).rejects.toThrow(/must not be empty/u);
  });
});
