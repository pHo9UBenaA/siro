import { type Layer, findLayerViolations } from '../../scripts/check/lib/layers.ts';

vi.setConfig({ testTimeout: 5000 });

const layers = (xs: readonly Layer[]): ReadonlySet<Layer> => new Set<Layer>(xs);

const config = {
  allowList: new Map<string, ReadonlySet<Layer>>(),
  allowedDependencies: {
    adapters: layers(['domain', 'shared']),
    application: layers(['domain', 'shared']),
    cli: layers(['application', 'adapters', 'domain', 'shared']),
    domain: layers(['shared']),
    shared: layers([]),
  },
  allowedPackages: {
    adapters: new Set(['node:', 'yaml']),
    application: new Set<string>(),
    cli: new Set(['node:', 'cac']),
    domain: new Set(['valibot']),
    shared: new Set<string>(),
  },
  barrelFiles: new Set<string>(),
  entryFiles: new Set<string>(),
};

describe('package-import allow-list', () => {
  it('flags a bare import outside the source layer allow-list', () => {
    expect.hasAssertions();
    const offenders = findLayerViolations(
      [{ content: "import { parse } from 'smol-toml';\n", relPath: 'domain/services/x.ts' }],
      config,
    );
    expect(offenders).toMatchObject([{ fromLayer: 'domain', kind: 'package', spec: 'smol-toml' }]);
  });
  it('accepts allow-listed packages and node builtins on their layer', () => {
    expect.hasAssertions();
    const offenders = findLayerViolations(
      [
        { content: "import * as v from 'valibot';\n", relPath: 'domain/schemas/x.ts' },
        { content: "import { join } from 'node:path';\n", relPath: 'adapters/y.ts' },
      ],
      config,
    );
    expect(offenders).toStrictEqual([]);
  });
});
