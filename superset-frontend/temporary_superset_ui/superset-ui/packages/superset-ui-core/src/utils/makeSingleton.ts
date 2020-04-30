interface ClassInterface<T, Args extends unknown[]> {
  new (...args: Args): T;
}

export default function makeSingleton<T, Args extends unknown[]>(
  BaseClass: ClassInterface<T, Args>,
  ...args: Args
): () => T {
  let singleton: T;

  return function getInstance() {
    if (!singleton) {
      singleton = new BaseClass(...args);
    }

    return singleton;
  };
}
