/** Visible escaping for untrusted human-facing text; never rewrite API/native paths. */
export const safeText = (text: string): string =>
  text
    .replace(
      // eslint-disable-next-line no-control-regex -- Deliberately encode untrusted terminal controls.
      /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/gu,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    )
    .replaceAll('##[', '#\\u0023[')
    .replace(/^(\s*)::/u, '$1\\u003a:');

/** JSON syntax and decoded values stay identical; CI must not parse legacy commands in it. */
export const safeJsonText = (json: string): string =>
  json
    .replace(
      /[\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/gu,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    )
    .replaceAll('##[', '\\u0023\\u0023[');
