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

/** Re-read NO_COLOR/FORCE_COLOR per call; fallback support is picocolors' import-time snapshot. */
const colorSupportedNow = (): boolean => {
  const { env } = process;
  if (typeof env.NO_COLOR !== 'undefined' && env.NO_COLOR !== '') {
    return false;
  }
  if ('FORCE_COLOR' in env) {
    // Unlike chalk, an empty FORCE_COLOR does not enable color.
    return env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== '';
  }
  return pc.isColorSupported;
};

interface RenderPalette {
  readonly colors: ReturnType<typeof pc.createColors>;
  readonly tag: Record<Severity, (str: string) => string>;
}

const renderFinding = (
  finding: LintResult['findings'][number],
  palette: RenderPalette,
  appendLine: (line: string) => void,
): void => {
  const location = palette.colors.dim(` (${safeText(finding.file ?? finding.directory)})`);
  appendLine(
    `${palette.tag[finding.severity](GLYPH[finding.severity])}  [${finding.pm ?? 'package'}] ${palette.colors.bold(safeText(finding.ruleId))}${location}`,
  );
  appendLine(`    ${safeText(finding.message)}`);
  if (finding.remediation?.kind === 'manual') {
    for (const step of finding.remediation.steps) appendLine(`    ↳ ${safeText(step)}`);
  }
  if (finding.docs) {
    appendLine(palette.colors.dim(`    → ${safeText(finding.docs)}`));
  }
};

const createRenderPalette = (): RenderPalette => {
  const colors = pc.createColors(colorSupportedNow());
  const tag: Record<Severity, (str: string) => string> = {
    error: colors.red,
    info: colors.cyan,
    warn: colors.yellow,
  };
  return { colors, tag };
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
    const palette = createRenderPalette();
    const installationDirectories =
      result.inspection.installationRoots.map((root) => safeText(root.directory)).join(', ') ||
      'none';
    collect(
      `Inspection: ${result.inspection.manifests.length} manifests; installation roots: ${installationDirectories}.`,
    );
    collect(
      'Unknown PM/version targets have no availability assessment; installation scope is explicit.',
    );
    if (result.findings.length === 0) {
      collect(palette.colors.green('✔ No security best-practice issues found.'));
    } else {
      for (const finding of result.findings) renderFinding(finding, palette, collect);
      const { error, warn, info } = result.summary;
      collect('');
      collect(`Summary: ${error} error, ${warn} warn, ${info} info`);
    }
    await io.stdout(lines.join('\n'));
  },
  name: 'pretty',
};
