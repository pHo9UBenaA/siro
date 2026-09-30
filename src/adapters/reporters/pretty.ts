import type { IO } from '../../core/contracts/io.ts';
import type { LintResult } from '../../core/contracts/lint-result.ts';
import type { Reporter } from '../../core/contracts/reporter.ts';
import type { Severity } from '../../core/contracts/pms.ts';
import pc from 'picocolors';
import { safeText } from '../safe-text.ts';
import { outputBudget, DEFAULT_SCAN_LIMITS } from '../../core/contracts/scan-limits.ts';

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
  const where = ctx.colors.dim(` (${safeText(finding.file ?? finding.directory)})`);
  ctx.io.stdout(
    `${ctx.tag[finding.severity](GLYPH[finding.severity])}  [${finding.pm ?? 'package'}] ${ctx.colors.bold(safeText(finding.ruleId))}${where}`,
  );
  ctx.io.stdout(`    ${safeText(finding.message)}`);
  for (const step of finding.remediation?.kind === 'manual' ? finding.remediation.steps : []) {
    ctx.io.stdout(`    ↳ ${safeText(step)}`);
  }
  if (finding.docs) {
    ctx.io.stdout(ctx.colors.dim(`    → ${safeText(finding.docs)}`));
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
  async format(result: LintResult, io: IO, context): Promise<void> {
    const lines: string[] = [];
    const consume = outputBudget(
      context.limits?.maxOutputBytes ?? DEFAULT_SCAN_LIMITS.maxOutputBytes,
    );
    const collect = (line: string) => {
      consume(`${line}\n`);
      lines.push(line);
    };
    const ctx = buildRenderCtx({ stdout: collect, stderr: collect });
    collect(
      `Inspection: ${result.inspection.manifests.length} manifests; installation roots: ${result.inspection.installationRoots.map((root) => safeText(root.directory)).join(', ') || 'none'}.`,
    );
    collect(
      'Unknown PM/version targets have no availability assessment; installation scope is explicit.',
    );
    if (result.findings.length === 0) {
      collect(ctx.colors.green('✔ No security best-practice issues found.'));
    } else {
      for (const finding of result.findings) renderFinding(finding, ctx);
      const { error, warn, info } = result.summary;
      collect('');
      collect(`Summary: ${error} error, ${warn} warn, ${info} info`);
    }
    await io.stdout(lines.join('\n'));
  },
  name: 'pretty',
};
