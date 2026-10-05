import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asAbsPath, ConfigError, loadConfig } from '@pho9ubenaa/siro';

const cwd = asAbsPath(mkdtempSync(join(tmpdir(), 'siro-installed-config-')));
const jsonFile = join(cwd, 'siro.config.json');
const marker = join(cwd, 'executed');
try {
  writeFileSync(jsonFile, '{"pms":["npm"],"rules":{"provenance":"off"}}');
  writeFileSync(
    join(cwd, 'siro.config.mjs'),
    `import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'ran');
    export default { pms: ['pnpm'] };`,
  );
  assert.deepEqual(await loadConfig(cwd), { pms: ['npm'], rules: { provenance: 'off' } });
  assert.equal(existsSync(marker), false, 'Automatic JSON must not execute coexisting code');

  assert.deepEqual(await loadConfig(cwd, { configPath: 'siro.config.mjs' }), { pms: ['pnpm'] });
  assert.equal(existsSync(marker), true, 'Explicit executable configuration must still work');
  rmSync(marker);
  rmSync(jsonFile);
  await assert.rejects(() => loadConfig(cwd), ConfigError);
  assert.equal(existsSync(marker), false, 'Legacy configuration must fail without execution');

  writeFileSync(jsonFile, '{"jsPlugins":["./siro.config.mjs"]}');
  await assert.rejects(() => loadConfig(cwd), ConfigError);
  assert.equal(existsSync(marker), false, 'JSON cannot load executable extensions');

  writeFileSync(jsonFile, '{}');
  await assert.rejects(() => loadConfig(cwd, { limits: { maxFileBytes: 1 } }), /maxFileBytes/u);
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
