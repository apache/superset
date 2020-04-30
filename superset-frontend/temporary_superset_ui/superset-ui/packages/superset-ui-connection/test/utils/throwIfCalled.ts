export default function throwIfCalled(args: unknown) {
  throw new Error(`Unexpected call to throwIfCalled(): ${JSON.stringify(args)}`);
}
