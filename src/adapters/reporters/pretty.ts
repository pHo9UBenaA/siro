import type { IO } from '../../domain/ports/io.ts';
import type { LintResult } from '../../domain/entities/lint-result.ts';
import type { Reporter } from '../../domain/ports/reporter.ts';
import type { Severity } from '../../domain/entities/pms.ts';
import pc from 'picocolors';

const GLYPH: Record<Severity, string> = {
  error: '✖ error',
  info: 'ℹ info',
  warn: '⚠ warn',
};

/**
 * Decide colour at call time, not at import time.
 *
 * picocolors snapshots `isColorSupported` when imported, so a later
 * `process.env.NO_COLOR = '1'` (or a different stdout) is ignored. The
 * reporter is invoked per `siro lint` run from many contexts (TTY, CI
 * with FORCE_COLOR, redirected output, …) — checking each call is the
 * only way NO_COLOR can truly win, as https://no-color.org/ requires.
 */
const colorSupportedNow = (): boolean => {
  const { env } = process;
  if (typeof env.NO_COLOR !== 'undefined' && env.NO_COLOR !== '') {
    return false;
  }
  if ('FORCE_COLOR' in env) {
    // We treat `FORCE_COLOR=''` (and `'0'`) as "do not force" — symmetric with
    // the NO_COLOR check above, where empty also means "unset". Note this is
    // the OPPOSITE of chalk, which reads `FORCE_COLOR=''` as level 1 (enabled);
    // the symmetry with NO_COLOR is the deliberate reference here.
    return env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== '';
  }
  return pc.isColorSupported;
};

type Colors = ReturnType<typeof pc.createColors>;

const renderFinding = (
  finding: LintResult['findings'][number],
  ctx: {
    readonly io: IO;
    readonly colors: Colors;
    readonly tag: Record<Severity, (str: string) => string>;
  },
): void => {
  let where = '';
  if (finding.file) {
    where = ctx.colors.dim(` (${finding.file})`);
  }
  ctx.io.stdout(
    `${ctx.tag[finding.severity](GLYPH[finding.severity])}  [${finding.pm}] ${ctx.colors.bold(finding.ruleId)}${where}`,
  );
  ctx.io.stdout(`    ${finding.message}`);
  for (const step of finding.manualSteps ?? []) {
    ctx.io.stdout(`    ↳ ${step}`);
  }
  if (finding.docs) {
    ctx.io.stdout(ctx.colors.dim(`    → ${finding.docs}`));
  }
};

const buildRenderCtx = (
  io: IO,
): {
  readonly io: IO;
  readonly colors: Colors;
  readonly tag: Record<Severity, (str: string) => string>;
} => {
  const colors = pc.createColors(colorSupportedNow());
  const tag: Record<Severity, (str: string) => string> = {
    error: colors.red,
    info: colors.cyan,
    warn: colors.yellow,
  };
  return { colors, io, tag };
};

export const prettyReporter: Reporter<'pretty'> = {
  format(result: LintResult, io: IO): void {
    const ctx = buildRenderCtx(io);
    const EMPTY = 0;
    if (result.findings.length === EMPTY) {
      io.stdout(ctx.colors.green('✔ No security best-practice issues found.'));
      return;
    }
    for (const finding of result.findings) {
      renderFinding(finding, ctx);
    }
    const { error, warn, info } = result.summary;
    io.stdout('');
    io.stdout(`Summary: ${error} error, ${warn} warn, ${info} info`);
  },
  name: 'pretty',
};
