import { spawn, spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createTempProject as fixture } from './helpers/temp-project.ts';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const cli = path.resolve(import.meta.dirname, '../dist/cli.js');
const run = (root: string, ...args: string[]) => {
  const result = spawnSync(
    process.execPath,
    [cli, 'lint', root, '--config', path.join(root, 'siro.config.mjs'), ...args],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, NO_COLOR: '1' },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
};

it.each([
  {
    name: 'rejected config Promise',
    config: "export default Promise.reject(new Error('rejected config'));",
  },
  {
    name: 'throwing async check',
    config: `export default {
      installationRoots: [],
      customRules: [{
        id: 'async', title: 'Async', description: 'Async check', severity: 'error',
        bindings: { npm: {
          async check() { throw new Error('rejected check'); },
        } },
      }],
    };`,
  },
  {
    name: 'check returning a rejected Promise',
    config: `export default {
      installationRoots: [],
      customRules: [{
        id: 'async', title: 'Async', description: 'Async check', severity: 'error',
        bindings: { npm: {
          check() { return Promise.reject(new Error('rejected check')); },
        } },
      }],
    };`,
  },
])('rejects a $name without a later unhandled rejection', ({ config }) => {
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

it.each([
  { name: 'unknown PM key', bindingKey: 'nmp', predicate: '', diagnostic: /bindings.*nmp/ },
  {
    name: 'rejecting accept',
    bindingKey: 'npm',
    predicate: "accept: async () => { throw new Error('predicate rejected'); },",
    diagnostic: /accept.*synchronous/,
  },
  {
    name: 'async applies',
    bindingKey: 'npm',
    predicate: '',
    applies: 'applies: async () => false,',
    diagnostic: /applies.*synchronous/,
  },
])('rejects helper $name through executable config with exit 2', (input) => {
  const entry = pathToFileURL(path.resolve(import.meta.dirname, '../dist/index.mjs')).href;
  const root = fixture({
    'siro.config.mjs': `
      import { requireConfigKey, CONFIG_FILES } from ${JSON.stringify(entry)};
      export default {
        installationRoots: [],
        customRules: [requireConfigKey({
          id: 'company-policy', title: 'Company policy',
          description: 'Require approved', severity: 'error',
          ${input.applies ?? ''}
          bindings: { ${input.bindingKey}: {
            file: CONFIG_FILES.npmrc, keyPath: ['approved'],
            value: true, message: 'Enable approved', ${input.predicate}
          } },
        })],
      };
    `,
  });
  try {
    const result = run(root, '--pm', 'npm', '--json');
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(input.diagnostic);
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
          bindings: { npm: {
            check() {
              return {
                state: 'violations',
                violations: Array.from({ length: 150_000 },
                  () => ({ state: 'violation', message: 'finding' })),
              };
            },
          } },
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
    const pretty = run(root);
    expect(pretty.status).toBe(0);
    expect(pretty.stdout).not.toContain('##[');
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
      const child = spawn(
        process.execPath,
        [cli, 'lint', root, '--config', path.join(root, 'siro.config.mjs'), flag],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 10_000,
        },
      );
      try {
        const stderrChunks: string[] = [];
        child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
          stderrChunks.push(chunk);
        });
        child.stdout.destroy();
        const completion = await new Promise<{
          code: number | null;
          signal: NodeJS.Signals | null;
        }>((resolve, reject) => {
          child.on('error', reject);
          child.on('close', (code, signal) => resolve({ code, signal }));
        });
        expect({ ...completion, stderr: stderrChunks.join('') }).toMatchObject({
          code: 70,
          signal: null,
          stderr: expect.not.stringContaining("Unhandled 'error' event"),
        });
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
