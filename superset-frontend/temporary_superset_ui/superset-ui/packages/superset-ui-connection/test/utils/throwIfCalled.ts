export default function throwIfCalled(args) {
  throw new Error(`Unexpected call to throwIfCalled(): ${JSON.stringify(args)}`);
}
