import { renderComparison, renderRulesDoc } from '../../scripts/docs.ts';
import type { Rule } from '../../src/domain/entities/rule.ts';
import { asRelPath } from '../../src/shared/paths.ts';

const rule: Rule = {
  id: 'fixture-policy',
  title: 'Fixture',
  description: 'Check a fixture policy.',
  severity: 'error',
  projectTypes: ['package'],
  docs: 'https://example.com/guide',
  bindings: {
    npm: {
      file: { kind: 'npmrc', path: asRelPath('.npmrc') },
      severity: 'info',
      docs: 'https://example.com/setting',
      versionNote: { configAvailableSince: 'npm 1.0.0', note: 'a | b' },
      check: () => ({ state: 'ok' }),
    },
    pnpm: { check: () => ({ state: 'ok' }) },
  },
};

it('renders actual bindings, input files, effective default levels, version notes and scope', () => {
  const markdown = renderRulesDoc([rule]);
  expect(markdown).toContain('Applies to: package.');
  expect(markdown).toContain(
    '| `npm` | `.npmrc` | info | (available since npm 1.0.0; a &#124; b) | [official docs](https://example.com/setting) |',
  );
  expect(markdown).toContain(
    '| `pnpm` | Repository | error | — | [upstream guide](https://example.com/guide) |',
  );
});

it('distinguishes implemented checks from missing bindings', () => {
  expect(renderComparison([rule])).toContain(
    '| `fixture-policy` | error | ✅ | ✅ | — | — | — | — |',
  );
  expect(renderComparison([])).not.toContain('`fixture-policy`');
});
