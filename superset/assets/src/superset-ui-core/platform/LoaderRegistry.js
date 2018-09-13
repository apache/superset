import Registry from './Registry';

export default class LoaderRegistry extends Registry {
  constructor(name) {
    super(name);
    this.promises = {};
  }

  register(key, value) {
    this.items[key] = () => value;
  }

  registerLoader(key, loader) {
    this.items[key] = loader;
  }

  load(key) {
    const promise = this.promises[key];
    if (promise) {
      return promise;
    }
    const loader = this.get(key);
    if (loader) {
      const newPromise = Promise.resolve(loader());
      this.promises[key] = newPromise;
      return newPromise;
    }
    return Promise.reject(`[${this.name}Registry] Item with key "${key}" is not registered.`);
  }
}
