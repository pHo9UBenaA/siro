import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_FILES } from '../src/domain/entities/config-files.ts';
import { codecFor } from '../src/adapters/codecs/store.ts';
import { parsePackageJson } from '../src/domain/schemas/package-json.ts';

const root = path.join(import.meta.dirname, 'fixtures');
const cases = readdirSync(root, { recursive: true, withFileTypes: true }).flatMap((entry) => {
  const config = Object.values(CONFIG_FILES).find((file) => file.path === entry.name);
  if (!entry.isFile() || !config) return [];
  const file = path.join(entry.parentPath, entry.name);
  return [{ file, name: path.relative(root, file), kind: config.kind }];
});

it.each(cases)('$name is valid input for its parser', ({ file, kind }) => {
  const parsed = codecFor(kind).parse(readFileSync(file, 'utf8'));
  expect(parsed).toBeTypeOf('object');
});

it.each(cases.filter(({ file }) => path.basename(file) === 'package.json'))(
  '$name has valid consumed manifest fields',
  ({ file }) => {
    expect(() => parsePackageJson(JSON.parse(readFileSync(file, 'utf8')))).not.toThrow();
  },
);
