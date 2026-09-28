import type { ConfigReadValue, ConfigValue } from './config-value.ts';
import type { PM, Severity } from './pms.ts';
import type { ProjectType } from './project-type.ts';
import type { Remediation } from './rule.ts';

export type { ConfigReadValue } from './config-value.ts';

export interface Finding {
  readonly ruleId: string;
  /** Absent for PM-neutral publication checks. */
  readonly pm?: PM;
  /** Evaluation directory relative to cwd; root is '.'. */
  readonly directory: string;
  readonly severity: Severity;
  readonly message: string;
  readonly file?: string;
  readonly remediation?: Remediation;
  readonly expected?: ConfigValue;
  readonly actual?: ConfigReadValue;
  readonly docs?: string;
}

export interface PolicyTarget {
  readonly pm: PM;
  /** Missing means unknown, not the installed binary's version. */
  readonly version?: string;
}

export interface Inspection {
  readonly manifests: readonly {
    readonly path: string;
    readonly projectType: ProjectType;
    /** Empty means unknown: target-dependent availability is not evaluated. */
    readonly targets: readonly PolicyTarget[];
  }[];
  readonly installationRoots: readonly {
    readonly directory: string;
    readonly targets: readonly PolicyTarget[];
  }[];
}

export interface LintResult {
  readonly findings: readonly Finding[];
  readonly summary: Readonly<Record<Severity, number>>;
  /** Selected inputs, not an attestation that all security controls passed. */
  readonly inspection: Inspection;
}
