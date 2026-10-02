import { spawn, spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createTempProject as fixture } from './helpers/temp-project.ts';
import path from 'node:path';

const cli = path.resolve(import.meta.dirname, '../dist/cli.js');
const run = (root: string, ...args: string[]) =>
  spawnSync(process.execPath, [cli, 'lint', root, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, NO_COLOR: '1' },
  });

it.each([
  "export default Promise.reject(new Error('rejected config'));",
  "export default { installationRoots:[], customRules:[{id:'async', title:'t', description:'d', severity:'error', bindings:{npm:{async check(){throw new Error('rejected check')}}}}] };",
  "export default { installationRoots:[], customRules:[{id:'async', title:'t', description:'d', severity:'error', bindings:{npm:{check(){return Promise.reject(new Error('rejected check'))}}}}] };",
])('rejects unsupported async extensions without a later unhandled rejection', (config) => {
  const root = fixture({ 'siro.config.mjs': config });
  try {
    const result = run(root, '--pm', 'npm', '--json');
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/synchronous|Promise|async/);
    expect(result.stderr).not.toContain('Node.js v');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('reports oversized grouped results as exit 2 without partial JSON', () => {
  const root = fixture({
    'siro.config.mjs': `
      export default {
        installationRoots: [],
        customRules: [{
          id: 'many', title: 'Many', description: 'Many findings', severity: 'info',
          bindings: { npm: { check() {
            return { state: 'violations', violations: Array.from({ length: 150_000 },
              () => ({ state: 'violation', message: 'finding' })) };
          } } },
        }],
      };
    `,
  });
  try {
    const result = run(root, '--pm', 'npm', '--json');
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('maxFindings');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('serializes legacy command openers safely while retaining JSON values', () => {
  const name = 'ordinary##[error]FORGED';
  const root = fixture({
    'siro.config.mjs': 'export default {installationRoots:[]};',
    [`${name}/package.json`]: '{"name":"pkg"}',
  });
  try {
    const json = run(root, '--json');
    expect(json.status).toBe(0);
    expect(json.stdout).not.toContain('##[');
    expect(JSON.parse(json.stdout).inspection.manifests[0].path).toBe(`${name}/package.json`);
    expect(run(root).stdout).not.toContain('##[');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

describe.skipIf(process.platform === 'win32')('POSIX names', () => {
  it('renders native control characters safely in findings and diagnostics', () => {
    const name = 'a\n::error title=Injected::forged\u001b[2J\u202e';
    const root = fixture({
      'siro.config.mjs': 'export default {installationRoots:[]};',
      [`${name}/package.json`]: '{"name":"pkg"}',
    });
    try {
      const result = run(root);
      expect(result.status).toBe(0);
      expect(result.stdout).not.toMatch(/^\s*::/mu);
      expect(result.stdout).not.toContain('\u001b');
      expect(result.stdout).not.toContain('\u202e');
      writeFileSync(path.join(root, name, 'package.json'), '{');
      const invalid = run(root, '--json');
      expect(invalid.status).toBe(2);
      expect(invalid.stdout).toBe('');
      expect(invalid.stderr).not.toMatch(/^\s*::/mu);
      expect(invalid.stderr).not.toContain('\u001b');
      expect(invalid.stderr).not.toContain('\u202e');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

it.each(['--json', '--help', '--version'])(
  'classifies a real closed output pipe as exit 70: %s',
  async (flag) => {
    const root = fixture({ 'siro.config.mjs': 'export default {installationRoots:[]};' });
    try {
      const child = spawn(process.execPath, [cli, 'lint', root, flag], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
      });
      let stderr = '';
      child.stderr.setEncoding('utf8').on('data', (chunk) => {
        stderr += chunk;
      });
      child.stdout.destroy();
      const code = await new Promise<number | null>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', resolve);
      });
      expect({ code, unhandled: stderr.includes("Unhandled 'error' event") }).toEqual({
        code: 70,
        unhandled: false,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
