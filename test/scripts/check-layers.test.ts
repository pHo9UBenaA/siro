import {
  type FileSource,
  type Layer,
  type LayerCheckConfig,
  defaultTopLevelLayer,
  findLayerViolations,
  formatViolation,
} from '../../scripts/check/lib/layers.ts';
import assert from 'node:assert';

vi.setConfig({ testTimeout: 5000 });

const SINGLE_VIOLATION = 1;
const FIRST_ELEMENT = 0;

const allowedDependencies: Record<Layer, ReadonlySet<Layer>> = {
  adapters: new Set<Layer>(['domain', 'shared']),
  application: new Set<Layer>(['domain', 'shared']),
  cli: new Set<Layer>(['application', 'adapters', 'domain', 'shared']),
  domain: new Set<Layer>(['shared']),
  shared: new Set<Layer>(),
};

const baseConfig: LayerCheckConfig = {
  // Mirror the live config in scripts/check/layers.mjs: both command files
  // are intentional composition roots that may reach into `adapters/`.
  allowList: new Map([
    ['application/commands/lint.ts', new Set<Layer>(['adapters'])],
    ['application/prepare-context.ts', new Set<Layer>(['adapters'])],
  ]),
  allowedDependencies,
  allowedPackages: {
    adapters: new Set(['node:']),
    application: new Set(['node:']),
    cli: new Set(['node:']),
    domain: new Set(['node:']),
    shared: new Set(['node:']),
  },
  barrelFiles: new Set(['index.ts', 'index.js']),
  entryFiles: new Set(['index.ts', 'version.ts']),
};

const file = (relPath: string, content: string): FileSource => ({ content, relPath });

describe(defaultTopLevelLayer, () => {
  it('maps a path to its first segment', () => {
    expect.hasAssertions();
    expect(defaultTopLevelLayer('domain/services/foo.ts')).toBe('domain');
    expect(defaultTopLevelLayer('adapters/codecs/json.ts')).toBe('adapters');
    expect(defaultTopLevelLayer('shared/errors.ts')).toBe('shared');
  });

  it('maps cli.ts and cli/* to the cli layer', () => {
    expect.hasAssertions();
    expect(defaultTopLevelLayer('cli.ts')).toBe('cli');
    expect(defaultTopLevelLayer('cli/handlers/lint.ts')).toBe('cli');
  });

  it('returns undefined for a top-level non-cli file whose first segment is not a known layer', () => {
    expect.hasAssertions();
    // index.ts / version.ts ultimately get filtered out via entryFiles in
    // `findLayerViolations`, but defaultTopLevelLayer itself never invents a
    // layer name — an unknown first segment yields undefined so a typo in
    // `allowedDependencies` keys cannot accidentally start matching live files.
    expect(defaultTopLevelLayer('index.ts')).toBeUndefined();
    expect(defaultTopLevelLayer('mystery.ts')).toBeUndefined();
  });
});

describe('findLayerViolations — clean tree and basic violations', () => {
  it('returns no violations for a clean tree', () => {
    expect.hasAssertions();
    const files = [
      file('domain/services/foo.ts', "import { bar } from '../entities/bar.ts';"),
      file('adapters/codecs/json.ts', "import { Codec } from '../../domain/ports/codec.ts';"),
    ];
    expect(findLayerViolations(files, baseConfig)).toStrictEqual([]);
  });

  it('flags an upward import from domain to adapters', () => {
    expect.hasAssertions();
    const files = [
      file('domain/services/bad.ts', "import { node } from '../../adapters/node-io.ts';"),
    ];
    const violations = findLayerViolations(files, baseConfig);
    expect(violations).toStrictEqual([
      {
        file: 'domain/services/bad.ts',
        fromLayer: 'domain',
        kind: 'cross-layer',
        spec: '../../adapters/node-io.ts',
        toLayer: 'adapters',
      },
    ]);
  });
});

describe('findLayerViolations — allow-list escape hatches', () => {
  it('honors the lint.ts file-level escape hatch in the allow list', () => {
    expect.hasAssertions();
    const files = [
      file('application/commands/lint.ts', "import { fs } from '../../adapters/node-io.ts';"),
    ];
    expect(findLayerViolations(files, baseConfig)).toStrictEqual([]);
  });

  it('does not extend the escape hatch to a sibling file in the same layer', () => {
    expect.hasAssertions();
    const files = [
      file('application/commands/other.ts', "import { fs } from '../../adapters/node-io.ts';"),
    ];
    const violations = findLayerViolations(files, baseConfig);
    expect(violations).toHaveLength(SINGLE_VIOLATION);
    const firstViolation = violations[FIRST_ELEMENT];
    assert(firstViolation, 'expected violation');
    expect(firstViolation.file).toBe('application/commands/other.ts');
  });
});

describe('findLayerViolations — entry file and barrel handling', () => {
  it('treats an entry file as layer-less when it appears as an import target', () => {
    expect.hasAssertions();
    const files = [
      file('cli.ts', "import { version } from './version.ts';"),
      file('version.ts', 'export const version = "0";'),
    ];
    expect(findLayerViolations(files, baseConfig)).toStrictEqual([]);
  });

  it('treats an entry file as layer-less when it appears as an import source', () => {
    expect.hasAssertions();
    const files = [
      file('index.ts', "import { nodeIO } from './adapters/node-io.ts';"),
      file('adapters/node-io.ts', ''),
    ];
    expect(findLayerViolations(files, baseConfig)).toStrictEqual([]);
  });

  it('flags a non-cli layer importing an entry barrel (back-edge via re-export)', () => {
    expect.hasAssertions();
    const files = [
      file('domain/services/sneaky.ts', "import { nodeFileSystem } from '../../index.ts';"),
    ];
    const violations = findLayerViolations(files, baseConfig);
    expect(violations).toHaveLength(SINGLE_VIOLATION);
    expect(violations[FIRST_ELEMENT]).toMatchObject({
      file: 'domain/services/sneaky.ts',
      fromLayer: 'domain',
      kind: 'barrel',
    });
  });

  it('still lets cli import an entry barrel (composition root)', () => {
    expect.hasAssertions();
    const files = [file('cli.ts', "import { x } from './index.ts';")];
    expect(findLayerViolations(files, baseConfig)).toStrictEqual([]);
  });

  it('does not flag a non-cli layer importing version.ts (a re-export-less leaf)', () => {
    expect.hasAssertions();
    const files = [file('domain/services/v.ts', "import { version } from '../../version.ts';")];
    expect(findLayerViolations(files, baseConfig)).toStrictEqual([]);
  });

  it('flags a non-cli layer importing the index.js barrel variant', () => {
    expect.hasAssertions();
    const files = [file('domain/services/sneaky.ts', "import { x } from '../../index.js';")];
    const violations = findLayerViolations(files, baseConfig);
    expect(violations).toHaveLength(SINGLE_VIOLATION);
    expect(violations[FIRST_ELEMENT]).toMatchObject({ fromLayer: 'domain', kind: 'barrel' });
  });
});

describe('findLayerViolations — package imports and same-layer', () => {
  it('ignores non-relative (package) imports', () => {
    expect.hasAssertions();
    const files = [file('domain/services/foo.ts', "import { resolve } from 'node:path';")];
    expect(findLayerViolations(files, baseConfig)).toStrictEqual([]);
  });

  it('skips same-layer imports', () => {
    expect.hasAssertions();
    const files = [file('domain/services/a.ts', "import { B } from '../entities/b.ts';")];
    expect(findLayerViolations(files, baseConfig)).toStrictEqual([]);
  });
});

describe('findLayerViolations — out-of-tree violations', () => {
  it('flags an import that escapes srcRoot (e.g. src → test or src → bench)', () => {
    expect.hasAssertions();
    const files = [
      file('adapters/leaky.ts', "import { helpers } from '../../test/helpers/ctx.ts';"),
    ];
    const violations = findLayerViolations(files, baseConfig);
    expect(violations).toStrictEqual([
      {
        file: 'adapters/leaky.ts',
        fromLayer: 'adapters',
        kind: 'out-of-tree',
        spec: '../../test/helpers/ctx.ts',
      },
    ]);
  });
});

describe('findLayerViolations — multi-line imports', () => {
  it('flags a multi-line static import that crosses a layer boundary', () => {
    expect.hasAssertions();
    const files = [
      file(
        'domain/services/bad.ts',
        "import {\n  one,\n  two,\n} from '../../adapters/node-io.ts';",
      ),
    ];
    const violations = findLayerViolations(files, baseConfig);
    expect(violations).toHaveLength(SINGLE_VIOLATION);
    expect(violations[FIRST_ELEMENT]).toMatchObject({
      file: 'domain/services/bad.ts',
      fromLayer: 'domain',
      kind: 'cross-layer',
      spec: '../../adapters/node-io.ts',
      toLayer: 'adapters',
    });
  });

  it('flags a multi-line `export ... from` re-export that crosses a layer boundary', () => {
    expect.hasAssertions();
    const files = [
      file(
        'domain/services/reexport.ts',
        "export {\n  helper,\n} from '../../adapters/node-io.ts';",
      ),
    ];
    const violations = findLayerViolations(files, baseConfig);
    expect(violations).toHaveLength(SINGLE_VIOLATION);
    const firstReexportViolation = violations[FIRST_ELEMENT];
    assert(firstReexportViolation, 'expected violation');
    expect(firstReexportViolation.fromLayer).toBe('domain');
  });
});

describe('findLayerViolations — dynamic imports', () => {
  it('flags a dynamic import that crosses a layer boundary', () => {
    expect.hasAssertions();
    const files = [
      file('domain/services/bad.ts', "const m = await import('../../adapters/node-io.ts');"),
    ];
    expect(findLayerViolations(files, baseConfig)).toHaveLength(SINGLE_VIOLATION);
  });

  it('flags a dynamic out-of-tree import as well', () => {
    expect.hasAssertions();
    const files = [file('adapters/leaky.ts', "const m = await import('../../bench/fixtures.ts');")];
    const violations = findLayerViolations(files, baseConfig);
    expect(violations).toHaveLength(SINGLE_VIOLATION);
    const firstDynViolation = violations[FIRST_ELEMENT];
    assert(firstDynViolation, 'expected violation');
    expect(firstDynViolation.kind).toBe('out-of-tree');
  });
});

describe(formatViolation, () => {
  it('renders a cross-layer violation in `file -> spec (from → to)` form', () => {
    expect.hasAssertions();
    expect(
      formatViolation({
        file: 'domain/foo.ts',
        fromLayer: 'domain',
        kind: 'cross-layer',
        spec: '../adapters/bar.ts',
        toLayer: 'adapters',
      }),
    ).toBe('domain/foo.ts  ->  ../adapters/bar.ts  (domain → adapters)');
  });

  it('renders an out-of-tree violation with the literal `outside src/` target', () => {
    expect.hasAssertions();
    // The target's layer is meaningless — what matters is that the import
    // escaped srcRoot. Render that fact verbatim so a CI log search for
    // "outside src/" surfaces every leak across the codebase.
    expect(
      formatViolation({
        file: 'adapters/leaky.ts',
        fromLayer: 'adapters',
        kind: 'out-of-tree',
        spec: '../../test/helpers/ctx.ts',
      }),
    ).toBe('adapters/leaky.ts  ->  ../../test/helpers/ctx.ts  (adapters → outside src/)');
  });
});
