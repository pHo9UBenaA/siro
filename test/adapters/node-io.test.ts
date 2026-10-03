import { Writable } from 'node:stream';
import { createNodeIO } from '../../src/adapters/node-io.ts';

const discard = () =>
  new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });

it('waits for write callbacks under backpressure and keeps output ordered', async () => {
  const chunks: string[] = [];
  const callbacks: (() => void)[] = [];
  const output = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, done) {
      chunks.push(String(chunk));
      callbacks.push(done);
    },
  });
  const completeNextWrite = () => {
    const callback = callbacks.shift();
    if (!callback) throw new Error('Expected a pending write callback.');
    callback();
  };
  const io = createNodeIO(output, discard());
  expect(output.listenerCount('error')).toBe(0); // No interception until this sink is used.
  let settled = false;
  const first = Promise.resolve(io.stdout('first')).then(() => {
    settled = true;
  });
  const second = io.stdout('second');
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(chunks).toEqual(['first\n']);
  completeNextWrite();
  expect(chunks).toEqual(['first\n', 'second\n']);
  completeNextWrite();
  await Promise.all([first, second]);
  expect(settled).toBe(true);
});

it.each(['callback', 'event', 'throw', 'close'] as const)(
  'observes a %s failure without leaving an unhandled stream error',
  async (kind) => {
    const failure = Object.assign(new Error('broken pipe'), { code: 'EPIPE', errno: -32 });
    const output = new Writable({
      write(_chunk, _encoding, done) {
        if (kind === 'callback') done(failure);
        if (kind === 'throw') throw failure;
      },
    });
    const io = createNodeIO(output, discard());
    const written = io.stdout('line');
    if (kind === 'event') output.emit('error', failure);
    if (kind === 'close') output.destroy();
    await expect(written).rejects.toThrow('Output failed');
    await new Promise<void>((resolve) => setImmediate(resolve));
    const listeners = output.listenerCount('error');
    await expect(io.stdout('later')).rejects.toThrow('Output failed');
    expect(output.listenerCount('error')).toBe(listeners);
  },
);
