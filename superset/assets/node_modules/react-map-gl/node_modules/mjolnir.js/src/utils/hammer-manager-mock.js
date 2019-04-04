// Hammer.Manager mock for use in environments without `document` / `window`.
export default function HammerManagerMock(m) {
  const instance = {};
  const chainedNoop = () => instance;
  instance.get = () => null;
  instance.set = chainedNoop;
  instance.on = chainedNoop;
  instance.off = chainedNoop;
  instance.destroy = chainedNoop;
  instance.emit = chainedNoop;
  return instance;
}
