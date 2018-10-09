export default class Registry {
  constructor(name = '') {
    this.name = name;
    this.items = {};
    this.promises = {};
  }

  has(key) {
    const item = this.items[key];
    return item !== null && item !== undefined;
  }

  registerValue(key, value) {
    this.items[key] = { value };
    delete this.promises[key];
    return this;
  }

  registerLoader(key, loader) {
    this.items[key] = { loader };
    delete this.promises[key];
    return this;
  }

  get(key) {
    const item = this.items[key];
    if (item) {
      return item.loader ? item.loader() : item.value;
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
    return Promise.reject(`Item with key "${key}" is not registered.`);
  }

  keys() {
    return Object.keys(this.items);
  }

  entries() {
    return this.keys().map(key => ({
      key,
      value: this.get(key),
    }));
  }

  entriesAsPromise() {
    const keys = this.keys();
    return Promise.all(keys.map(key => this.getAsPromise(key)))
      .then(values => values.map((value, i) => ({
        key: keys[i],
        value,
      })));
  }

  remove(key) {
    delete this.items[key];
    delete this.promises[key];
    return this;
  }
}
