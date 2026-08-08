import { parseBlocks } from '../../scripts/review/lib/scan-long-comments.mjs';

vi.setConfig({ testTimeout: 5000 });

const FIRST_BLOCK_INDEX = 0;
const SECOND_BLOCK_INDEX = 1;
const EXPECTED_ONE_BLOCK = 1;
const EXPECTED_TWO_BLOCKS = 2;
const JSDOC_MIN_FILL = 8;
const REPEAT_11 = 11;
const REPEAT_10 = 10;
const REPEAT_12 = 12;
const REPEAT_5 = 5;

describe('parseBlocks — basic cases', () => {
  it('returns no blocks for empty text', () => {
    expect.hasAssertions();
    expect(parseBlocks('')).toStrictEqual([]);
  });

  it('ignores a multi-line JSDoc shorter than MIN_LINES', () => {
    expect.hasAssertions();
    const text = ['/**', ' * short', ' */'].join('\n');
    expect(parseBlocks(text)).toStrictEqual([]);
  });

  it('captures a multi-line JSDoc that meets MIN_LINES with start/end/line count', () => {
    expect.hasAssertions();
    const lines = [
      '/**',
      ...Array.from({ length: JSDOC_MIN_FILL }, (__, idx) => ` * line ${idx}`),
      ' */',
    ];
    const blocks = parseBlocks(lines.join('\n'));
    expect(blocks).toHaveLength(EXPECTED_ONE_BLOCK);
    expect(blocks[FIRST_BLOCK_INDEX]).toMatchObject({
      endLine: 10,
      lineCount: 10,
      startLine: 1,
    });
  });

  it('does NOT capture a one-line JSDoc (open and close on same line)', () => {
    expect.hasAssertions();
    const text = '/** one-line block */';
    expect(parseBlocks(text)).toStrictEqual([]);
  });

  it('does NOT manufacture a phantom block when a one-line JSDoc is followed by an unrelated later close marker', () => {
    expect.hasAssertions();
    const lines = [
      '/** one-line JSDoc */',
      'const x = 1;',
      'const y = 2;',
      'const z = 3;',
      '',
      '/*',
      ' * not a JSDoc',
      ' * but it ends with',
      ' * a close marker',
      ' * which the scanner',
      ' * should not pair',
      ' * with line 0',
      ' */',
    ];
    expect(parseBlocks(lines.join('\n'))).toStrictEqual([]);
  });
});

describe('parseBlocks — inline and multi-block', () => {
  it('does not let an inline `/** x */` open a phantom block that swallows later JSDoc', () => {
    expect.hasAssertions();
    const realDoc = `/**\n${' * line\n'.repeat(REPEAT_11)} */`;
    const text = `// note: a one-line /** x */ inline comment\n${'const a = 1;\n'.repeat(REPEAT_10)}${realDoc}\n`;
    const blocks = parseBlocks(text);
    expect(blocks.some((blk) => blk.startLine === REPEAT_12)).toBe(true);
    expect(blocks.every((blk) => blk.startLine !== EXPECTED_ONE_BLOCK)).toBe(true);
  });

  it('captures two separate multi-line JSDocs independently', () => {
    expect.hasAssertions();
    const first = ['/**', ...Array.from({ length: JSDOC_MIN_FILL }, () => ' * a'), ' */'];
    const between = ['', 'const x = 1;', ''];
    const second = ['/**', ...Array.from({ length: REPEAT_10 }, () => ' * b'), ' */'];
    const text = [...first, ...between, ...second].join('\n');
    const blocks = parseBlocks(text);
    expect(blocks).toHaveLength(EXPECTED_TWO_BLOCKS);
    expect(blocks[FIRST_BLOCK_INDEX]).toMatchObject({ lineCount: 10 });
    expect(blocks[SECOND_BLOCK_INDEX]).toMatchObject({ lineCount: 12 });
  });
});

describe('parseBlocks — block comment styles', () => {
  it('captures a plain /* ... */ block meeting MIN_LINES', () => {
    expect.hasAssertions();
    const lines = ['/*', ...Array.from({ length: REPEAT_10 }, () => ' * regular block'), ' */'];
    const blocks = parseBlocks(lines.join('\n'));
    expect(blocks).toHaveLength(EXPECTED_ONE_BLOCK);
    expect(blocks[FIRST_BLOCK_INDEX]).toMatchObject({
      endLine: 12,
      lineCount: 12,
      startLine: 1,
    });
  });

  it('captures a run of consecutive `//` line comments meeting MIN_LINES', () => {
    expect.hasAssertions();
    const lines = Array.from({ length: REPEAT_12 }, (__, idx) => `// header line ${idx}`);
    const blocks = parseBlocks(lines.join('\n'));
    expect(blocks).toHaveLength(EXPECTED_ONE_BLOCK);
    expect(blocks[FIRST_BLOCK_INDEX]).toMatchObject({
      endLine: 12,
      lineCount: 12,
      startLine: 1,
    });
  });

  it('ignores a short `//` run', () => {
    expect.hasAssertions();
    expect(parseBlocks(Array.from({ length: REPEAT_5 }, () => '// x').join('\n'))).toStrictEqual(
      [],
    );
  });

  it('does not treat a line-internal `//` (e.g. a URL) as a comment line', () => {
    expect.hasAssertions();
    const lines = Array.from({ length: REPEAT_12 }, () => "const u = 'https://example.com/x';");
    expect(parseBlocks(lines.join('\n'))).toStrictEqual([]);
  });

  it('reports a >=10-line plain /* */ block', () => {
    expect.hasAssertions();
    const text = [
      '/*',
      ...Array.from({ length: REPEAT_10 }, (__, idx) => ` line ${idx}`),
      '*/',
    ].join('\n');
    const blocks = parseBlocks(text);
    expect(blocks).toStrictEqual([{ content: text, endLine: 12, lineCount: 12, startLine: 1 }]);
  });

  it('does not treat a `//*` decorative line as a block opener', () => {
    expect.hasAssertions();
    const text = ['//************', 'const x = 1;', 'const y = 2;'].join('\n');
    expect(parseBlocks(text)).toStrictEqual([]);
  });
});
