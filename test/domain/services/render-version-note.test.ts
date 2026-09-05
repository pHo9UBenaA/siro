import { renderVersionNoteMessage } from '../../../src/domain/services/render-version-note.ts';

describe(renderVersionNoteMessage, () => {
  it('returns the message unchanged without metadata', () => {
    expect.hasAssertions();
    expect(renderVersionNoteMessage('Pin the key.', void 0)).toBe('Pin the key.');
  });

  it('renders fields in stable order', () => {
    expect.hasAssertions();
    expect(
      renderVersionNoteMessage('Pin the key.', {
        configAvailableSince: 'npm 9.0.0',
        defaultSafeSince: 'npm 11.0.0',
        note: 'replaces legacy-flag',
      }),
    ).toBe(
      'Pin the key. (available since npm 9.0.0; default safe since npm 11.0.0; replaces legacy-flag)',
    );
  });

  it('returns the message unchanged for empty metadata', () => {
    expect.hasAssertions();
    expect(renderVersionNoteMessage('Pin the key.', {})).toBe('Pin the key.');
  });
});
