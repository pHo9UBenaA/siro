import { rmSync } from 'node:fs';
import path from 'node:path';
import { run } from '../src/cli.ts';
import { parseGithubAnnotation } from './helpers/github-annotation.ts';
import { captureIO } from './helpers/io.ts';
import { createTempProject } from './helpers/temp-project.ts';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const packageJson = JSON.stringify({ name: 'demo', packageManager: 'npm@10.9.0' });

it('emits GitHub annotations naming the rule, PM and severity command', async () => {
  const { io, out } = captureIO();
  await run(['lint', '--reporter', 'github', path.join(FIXTURES, 'npm-bad')], io);
  const annotations = out()
    .split('\n')
    .filter((line) => line.startsWith('::'))
    .map(parseGithubAnnotation);
  expect(annotations.length).toBeGreaterThan(0);
  expect(annotations).toStrictEqual(
    expect.arrayContaining([
      expect.objectContaining({
        body: expect.stringMatching(/^\[npm\] /u),
        command: 'error',
        props: expect.objectContaining({ title: 'disable-lifecycle-scripts' }),
      }),
    ]),
  );
});

it('applies warn and off rule overrides from the same config', async () => {
  const root = createTempProject({
    'package.json': packageJson,
    'siro.config.mjs':
      "export default { rules: { 'pin-exact-versions': 'warn', provenance: 'off' } };\n",
  });
  try {
    const { io, out } = captureIO();
    await run(
      ['lint', '--config', path.join(root, 'siro.config.mjs'), '--reporter', 'json', root],
      io,
    );
    const parsed: { findings: { ruleId: string; severity: string }[] } = JSON.parse(out());
    const finding = parsed.findings.find((entry) => entry.ruleId === 'pin-exact-versions');
    expect(finding).toMatchObject({ ruleId: 'pin-exact-versions', severity: 'warn' });
    expect(parsed.findings.map((entry) => entry.ruleId)).not.toContain('provenance');
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

it.each<{ name: string; files: Record<string, string>; pattern: RegExp }>([
  {
    name: 'restricted PM with no detected manager',
    files: {
      'package.json': '{"name":"demo"}',
      'siro.config.mjs': "export default { pms: ['pnpm'] };\n",
    },
    pattern: /no package manager detected.*restricts pms/iu,
  },
  {
    name: 'corrupt package.json',
    files: { 'package.json': '{ not valid json' },
    pattern: /package\.json: invalid json/iu,
  },
  {
    name: 'malformed codec input',
    files: {
      'package.json': '{"name":"demo","packageManager":"bun@1.3.0"}',
      'bunfig.toml': '[install]\nexact = "unterminated',
    },
    pattern: /bunfig\.toml/u,
  },
  {
    name: 'detected PM outside configured restriction',
    files: { 'siro.config.mjs': "export default { pms: ['pnpm'] };\n" },
    pattern: /do not match configured pms/u,
  },
  {
    name: 'no PM without a silent npm fallback',
    files: { 'package.json': '{"name":"demo"}' },
    pattern: /no package manager detected.*pass --pm/iu,
  },
  {
    name: 'unknown rule override',
    files: { 'siro.config.mjs': "export default { rules: { 'no-such-rule': 'warn' } };\n" },
    pattern: /no-such-rule/u,
  },
])('exits 2 for $name', async ({ files, pattern }) => {
  const root = createTempProject({ 'package.json': packageJson, ...files });
  try {
    const { io, err } = captureIO();
    const configArgs = files['siro.config.mjs']
      ? ['--config', path.join(root, 'siro.config.mjs')]
      : [];
    expect(await run(['lint', root, ...configArgs], io)).toBe(2);
    expect(err()).toMatch(pattern);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

it.each<{ name: string; files: Record<string, string>; pattern: RegExp }>([
  {
    name: 'non-mapping JSON config root',
    files: { 'package.json': '{"name":"demo"}', 'deno.json': '[]' },
    pattern: /deno\.json: config root must be a mapping/iu,
  },
  {
    name: 'malformed custom rule',
    files: {
      'package.json': '{"name":"demo","packageManager":"pnpm@10.0.0"}',
      'siro.config.mjs': 'export default { customRules: [null] };\n',
    },
    pattern: /customRules\.0/iu,
  },
])('exits 2 and identifies $name', async ({ files, pattern }) => {
  const root = createTempProject(files);
  try {
    const { io, out, err } = captureIO();
    const configArgs = files['siro.config.mjs']
      ? ['--config', path.join(root, 'siro.config.mjs')]
      : [];
    const status = await run(['lint', root, ...configArgs], io);
    expect(status, `stdout: ${out()}\nstderr: ${err()}`).toBe(2);
    expect(err()).toMatch(pattern);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
