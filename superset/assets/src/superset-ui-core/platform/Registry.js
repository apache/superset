export default class Registry {
  constructor(name) {
    this.name = name;
    this.items = {};
  }

  add(key, value) {
    this.items[key] = value;
  }

  get(key, accessor) {
    const item = this.items[key];
    if (item) {
      return accessor ? accessor(item) : item;
    }
    return null;
  }

  getAsPromise(key, accessor) {
    const item = this.get(key);
    if (item) {
      return Promise.resolve(accessor ? accessor(item) : item);
    }
    return Promise.reject(`[${this.name}] Item with key "${key}" is not registered.`);
  }
}
