export default function throwIfCalled(args: any) {
  throw new Error(`Unexpected call to throwIfCalled(): ${JSON.stringify(args)}`);
}
