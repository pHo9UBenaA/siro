import type { VersionNote } from '../entities/rule.ts';

const buildVersionNoteParts = (versionNote: VersionNote): readonly string[] => {
  const parts: string[] = [];
  if (typeof versionNote.configAvailableSince !== 'undefined') {
    parts.push(`available since ${versionNote.configAvailableSince}`);
  }
  if (typeof versionNote.defaultSafeSince !== 'undefined') {
    parts.push(`default safe since ${versionNote.defaultSafeSince}`);
  }
  if (typeof versionNote.note !== 'undefined') {
    parts.push(versionNote.note);
  }
  return parts;
};

export const renderVersionNoteMessage = (
  message: string,
  versionNote: VersionNote | undefined,
): string => {
  if (typeof versionNote === 'undefined') {
    return message;
  }
  const parts = buildVersionNoteParts(versionNote);
  if (parts.length === 0) {
    return message;
  }
  return `${message} (${parts.join('; ')})`;
};
