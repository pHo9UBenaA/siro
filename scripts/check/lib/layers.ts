import path from 'node:path';

/**
 * Pure layer-check logic (string-in / string-out). All paths are
 * POSIX-style, relative to `srcRoot`.
 */

const LAYERS = ['cli', 'application', 'domain', 'adapters', 'shared'] as const;
export type Layer = (typeof LAYERS)[number];

const LAYER_SET: ReadonlySet<string> = new Set(LAYERS);

const isLayer = (value: string): value is Layer => LAYER_SET.has(value);

export interface FileSource {
  /** POSIX-style path relative to the src root, e.g. `domain/services/foo.ts`. */
  readonly relPath: string;
  readonly content: string;
}

export interface LayerCheckConfig {
  /** `from-layer` → set of layers it may import. */
  readonly allowedDependencies: Readonly<Record<Layer, ReadonlySet<Layer>>>;
  /** File-level escape hatch: rel POSIX path → extra allowed target layers. */
  readonly allowList: ReadonlyMap<string, ReadonlySet<Layer>>;
  /**
   * Files at these rel paths are treated as belonging to no layer — they are
   * skipped as sources AND never appear as targets, so cross-layer re-exports
   * in entry points (`index.ts`, `version.ts`) don't masquerade as a layer.
   */
  readonly entryFiles: ReadonlySet<string>;
  /**
   * Subset of `entryFiles` that re-export across layers (the public-API
   * barrel). Importing one pulls every layer into the importer transitively,
   * so a non-cli layer targeting a barrel is a back-edge — flagged even though
   * the file is layer-less as a target. Leaf entry points (e.g. `version.ts`)
   * stay in `entryFiles` only and remain freely importable.
   */
  readonly barrelFiles: ReadonlySet<string>;
  /**
   * Bare-specifier (npm package / node builtin) allow-list per layer. The
   * token `node:` stands for every `node:`-prefixed builtin; scoped
   * packages match on `@scope/name`. A bare import outside the source
   * layer's set is a `package` violation — this is what keeps effectful
   * runtime deps out of `domain/` without a human grep.
   */
  readonly allowedPackages: Readonly<Record<Layer, ReadonlySet<string>>>;
  /**
   * Optional override for layer detection. Defaults to "first path segment",
   * with `cli.ts` and `cli/*` treated as the `cli` layer.
   */
  readonly topLevelLayer?: (relPath: string) => Layer | undefined;
}

/** `cross-layer` | `out-of-tree` | `barrel` | `package` violation. */
export type Violation =
  | CrossLayerViolation
  | OutOfTreeViolation
  | BarrelViolation
  | PackageViolation;

interface CrossLayerViolation {
  readonly kind: 'cross-layer';
  readonly file: string;
  readonly spec: string;
  readonly fromLayer: Layer;
  readonly toLayer: Layer;
}

interface OutOfTreeViolation {
  readonly kind: 'out-of-tree';
  readonly file: string;
  readonly spec: string;
  readonly fromLayer: Layer;
}

interface BarrelViolation {
  readonly kind: 'barrel';
  readonly file: string;
  readonly spec: string;
  readonly fromLayer: Layer;
}

interface PackageViolation {
  readonly kind: 'package';
  readonly file: string;
  readonly spec: string;
  readonly fromLayer: Layer;
}

// Multi-line-tolerant static import/export regex. `[^'";]` matches newlines
// so multi-line specifiers are caught. Known gaps: two imports on one line
// (the formatter splits them), `import` inside a block comment (false positive, rare).
const STATIC_IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?from\s+)?['"](?<specifier>[^'"]+)['"]/gu;
// Dynamic `import('...')` — string-literal targets only. Variable-argument
// imports are a known gap (requires AST analysis for an unlikely exploit).
const DYNAMIC_IMPORT_RE = /(?:^|[^.\w])import\s*\(\s*['"](?<specifier>[^'"]+)['"]/gu;

export const defaultTopLevelLayer = (relPath: string): Layer | undefined => {
  if (relPath === 'cli.ts' || relPath.startsWith('cli/')) {
    return 'cli';
  }
  const [first] = relPath.split('/');
  if (typeof first !== 'undefined' && isLayer(first)) {
    return first;
  }
  return void 0;
};

/** Yield every imported specifier in source order. */
const importSpecs = function* importSpecs(content: string): Generator<string> {
  for (const match of content.matchAll(STATIC_IMPORT_RE)) {
    const { groups } = match;
    if (groups && typeof groups.specifier !== 'undefined') {
      yield groups.specifier;
    }
  }
  for (const match of content.matchAll(DYNAMIC_IMPORT_RE)) {
    const { groups } = match;
    if (groups && typeof groups.specifier !== 'undefined') {
      yield groups.specifier;
    }
  }
};

/** Resolve a relative specifier to a POSIX rel path anchored to the src root. */
const resolveRelative = (fromRel: string, spec: string): string => {
  const dir = path.posix.dirname(fromRel);
  const joined = path.posix.join(dir, spec);
  return path.posix.normalize(joined);
};

const FIRST_SEGMENT = 0;
const SCOPED_SEGMENTS = 2;

const packageNameOf = (spec: string): string => {
  if (spec.startsWith('node:')) {
    return 'node:';
  }
  const segments = spec.split('/');
  if (spec.startsWith('@')) {
    return segments.slice(FIRST_SEGMENT, SCOPED_SEGMENTS).join('/');
  }
  return segments[FIRST_SEGMENT] ?? spec;
};

interface CheckImportContext {
  readonly file: FileSource;
  readonly fromLayer: Layer;
  readonly allowed: ReadonlySet<Layer>;
  readonly extraAllowed: ReadonlySet<Layer>;
  readonly config: LayerCheckConfig;
  readonly layerOf: (relPath: string) => Layer | undefined;
  readonly offenders: Violation[];
}

const checkBareImport = (spec: string, ctx: CheckImportContext): void => {
  if (!ctx.config.allowedPackages[ctx.fromLayer].has(packageNameOf(spec))) {
    ctx.offenders.push({ file: ctx.file.relPath, fromLayer: ctx.fromLayer, kind: 'package', spec });
  }
};

const checkBarrelImport = (targetRel: string, spec: string, ctx: CheckImportContext): boolean => {
  if (!ctx.config.barrelFiles.has(targetRel)) {
    return false;
  }
  if (ctx.fromLayer !== 'cli') {
    ctx.offenders.push({ file: ctx.file.relPath, fromLayer: ctx.fromLayer, kind: 'barrel', spec });
  }
  return true;
};

const checkCrossLayer = (targetRel: string, spec: string, ctx: CheckImportContext): void => {
  const toLayer = ctx.layerOf(targetRel);
  if (
    typeof toLayer !== 'undefined' &&
    toLayer !== ctx.fromLayer &&
    !ctx.allowed.has(toLayer) &&
    !ctx.extraAllowed.has(toLayer)
  ) {
    ctx.offenders.push({
      file: ctx.file.relPath,
      fromLayer: ctx.fromLayer,
      kind: 'cross-layer',
      spec,
      toLayer,
    });
  }
};

const checkRelativeImport = (spec: string, ctx: CheckImportContext): void => {
  const targetRel = resolveRelative(ctx.file.relPath, spec);
  if (targetRel.startsWith('../')) {
    ctx.offenders.push({
      file: ctx.file.relPath,
      fromLayer: ctx.fromLayer,
      kind: 'out-of-tree',
      spec,
    });
    return;
  }
  if (checkBarrelImport(targetRel, spec, ctx)) {
    return;
  }
  checkCrossLayer(targetRel, spec, ctx);
};

const checkImportSpec = (spec: string, ctx: CheckImportContext): void => {
  if (!spec.startsWith('.')) {
    checkBareImport(spec, ctx);
    return;
  }
  checkRelativeImport(spec, ctx);
};

const checkFileImports = (
  file: FileSource,
  ctx: {
    readonly config: LayerCheckConfig;
    readonly layerOf: (relPath: string) => Layer | undefined;
    readonly offenders: Violation[];
  },
): void => {
  const fromLayer = ctx.layerOf(file.relPath);
  if (typeof fromLayer === 'undefined') {
    return;
  }
  const allowed = ctx.config.allowedDependencies[fromLayer];
  if (typeof allowed === 'undefined') {
    return;
  }
  const extraAllowed = ctx.config.allowList.get(file.relPath) ?? new Set<Layer>();
  const importCtx: CheckImportContext = {
    allowed,
    config: ctx.config,
    extraAllowed,
    file,
    fromLayer,
    layerOf: ctx.layerOf,
    offenders: ctx.offenders,
  };
  for (const spec of importSpecs(file.content)) {
    checkImportSpec(spec, importCtx);
  }
};

export const findLayerViolations = (
  files: readonly FileSource[],
  config: LayerCheckConfig,
): Violation[] => {
  const baseLayer = config.topLevelLayer ?? defaultTopLevelLayer;
  const layerOf = (relPath: string): Layer | undefined => {
    if (config.entryFiles.has(relPath)) {
      return;
    }
    return baseLayer(relPath);
  };
  const offenders: Violation[] = [];
  const ctx = { config, layerOf, offenders };
  for (const file of files) {
    checkFileImports(file, ctx);
  }
  return offenders;
};

export const formatViolation = (viol: Violation): string => {
  if (viol.kind === 'out-of-tree') {
    return `${viol.file}  ->  ${viol.spec}  (${viol.fromLayer} → outside src/)`;
  }
  if (viol.kind === 'barrel') {
    return `${viol.file}  ->  ${viol.spec}  (${viol.fromLayer} → entry barrel; only cli may import the public-API barrel)`;
  }
  if (viol.kind === 'package') {
    return `${viol.file}  ->  ${viol.spec}  (${viol.fromLayer} → package import not in allow-list)`;
  }
  return `${viol.file}  ->  ${viol.spec}  (${viol.fromLayer} → ${viol.toLayer})`;
};
