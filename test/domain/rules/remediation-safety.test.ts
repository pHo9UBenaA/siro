import type { ConfigFileRef } from '../../../src/domain/entities/rule.ts';
import assert from 'node:assert/strict';
import { rules } from '../../../src/domain/builtin-rules.ts';
import { makePublishableCtx } from '../../helpers/ctx.ts';
import { isPlainRecord } from '../../../src/shared/records.ts';
import { CONFIG_FILES } from '../../../src/domain/entities/config-files.ts';
import type { ParsedConfig } from '../../../src/domain/entities/config-value.ts';

const scenarios: readonly { name: string; config: ParsedConfig }[] = [
  { name: 'missing settings', config: {} },
  {
    name: 'TLS disabled alongside HTTP exceptions',
    config: { enableStrictSsl: false, unsafeHttpWhitelist: ['registry.example'] },
  },
  { name: 'scalar install settings', config: { install: false } },
  { name: 'array install settings', config: { install: [] } },
  {
    name: 'Deno age with exclusions',
    config: { minimumDependencyAge: { age: 0, exclude: ['reviewed-package'] } },
  },
  {
    name: 'Deno age with malformed exclusions',
    config: { minimumDependencyAge: { age: 0, exclude: false } },
  },
];

for (const { name, config } of scenarios) {
  it(`automatic remedies satisfy the check and preserve unrelated data: ${name}`, () => {
    let exercised = 0;
    for (const rule of rules)
      for (const [pm, binding] of Object.entries(rule.bindings)) {
        const files = new Map(
          Object.values(CONFIG_FILES).map((file) => [
            file.path,
            structuredClone(config) as Record<string, unknown>,
          ]),
        );
        const readConfig = (file: ConfigFileRef) => {
          const data = files.get(file.path);
          assert(data, `Unexpected remediation target: ${file.path}`);
          return data;
        };
        const ctx = makePublishableCtx({ readConfig });
        const primary = binding.file ? readConfig(binding.file) : {};
        const result = binding.check(ctx, primary);
        if (result.state !== 'violation' || result.remediation?.kind !== 'automatic') continue;
        exercised += 1;
        for (const operation of result.remediation.operations) {
          let parent = readConfig(operation.file);
          for (const key of operation.keyPath.slice(0, -1)) {
            if (parent[key] === undefined) parent[key] = {};
            const next = parent[key];
            assert(isPlainRecord(next), `${rule.id}/${pm}: must not replace a non-object parent`);
            parent = next;
          }
          const key = operation.keyPath.at(-1)!;
          assert(
            !isPlainRecord(parent[key]) && !Array.isArray(parent[key]),
            `${rule.id}/${pm}: must not discard a settings container`,
          );
          parent[key] = operation.value;
        }
        expect(binding.check(ctx, primary).state, `${rule.id}/${pm}`).toBe('ok');
      }
    expect(exercised).toBeGreaterThan(0);
  });
}
