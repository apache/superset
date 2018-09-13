export default class Registry {
  constructor(name) {
    this.name = name;
    this.items = {};
  }

  has(key) {
    const item = this.items[key];
    return item !== null && item !== undefined;
  }

  register(key, value) {
    this.items[key] = value;
  }

  get(key) {
    const item = this.items[key];
    if (item) {
      return item;
    }
    return null;
  }

  getAsPromise(key) {
    const promise = this.promises[key];
    if (promise) {
      return promise;
    }
    const item = this.get(key);
    if (item) {
      const newPromise = Promise.resolve(item);
      this.promises[key] = newPromise;
      return newPromise;
    }
    return Promise.reject(`[${this.name}Registry] Item with key "${key}" is not registered.`);
  }
}
