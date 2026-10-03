/** Return the exact thrown value, including undefined; fail if the action succeeds. */
export const captureThrown = (action: () => unknown): unknown => {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw.');
};
