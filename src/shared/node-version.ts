export const SUPPORTED_NODE_RANGE = '^22.18.0 || ^23.6.0 || >=24.0.0';

const MAJOR_22 = 22;
const MINOR_22 = 18;
const MAJOR_23 = 23;
const MINOR_23 = 6;
const ALWAYS_SUPPORTED_SINCE = 24;

export const isSupportedNodeVersion = (version: string): boolean => {
  const [majorRaw = '', minorRaw = '0'] = version.replace(/^v/u, '').split('.');
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  if (major >= ALWAYS_SUPPORTED_SINCE) {
    return true;
  }
  if (major === MAJOR_23) {
    return minor >= MINOR_23;
  }
  if (major === MAJOR_22) {
    return minor >= MINOR_22;
  }
  return false;
};
