interface ClassInterface<T> {
  new (...args: any[]): T;
}

export default function makeSingleton<T>(BaseClass: ClassInterface<T>, ...args: any[]): () => T {
  let singleton: T;

  return function getInstance() {
    if (!singleton) {
      singleton = new BaseClass(...args);
    }

    return singleton;
  };
}
