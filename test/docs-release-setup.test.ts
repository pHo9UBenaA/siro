import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

vi.setConfig({ testTimeout: 5000 });

const ROOT = path.join(import.meta.dirname, '..');
const YAML_BLOCK = 1;
const FIRST = 0;

describe('release setup', () => {
  it('embeds the executable publish job', () => {
    expect.hasAssertions();
    const releaseSetup = readFileSync(path.join(ROOT, 'docs/release-setup.md'), 'utf8');
    const embeddedWorkflow = releaseSetup
      .split('```yaml\n')
      .at(YAML_BLOCK)!
      .split('\n```')
      .at(FIRST)!;
    const publishWorkflow = readFileSync(path.join(ROOT, '.github/workflows/publish.yaml'), 'utf8');

    expect(parse(embeddedWorkflow)?.jobs?.publish).toStrictEqual(
      parse(publishWorkflow)?.jobs?.publish,
    );
  });
});
