import Registry from './Registry';

export default class RegistryWithDefaultKey extends Registry {
  constructor({ initialDefaultKey = undefined, setFirstItemAsDefault = false, ...rest } = {}) {
    super(rest);
    this.initialDefaultKey = initialDefaultKey;
    this.defaultKey = initialDefaultKey;
    this.setFirstItemAsDefault = setFirstItemAsDefault;
  }

  clear() {
    super.clear();
    this.defaultKey = this.initialDefaultKey;

    return this;
  }

  get(key) {
    return super.get(key || this.defaultKey);
  }

  registerValue(key, value) {
    super.registerValue(key, value);
    // If there is no default, set as default
    if (this.setFirstItemAsDefault && !this.defaultKey) {
      this.defaultKey = key;
    }

    return this;
  }

  registerLoader(key, loader) {
    super.registerLoader(key, loader);
    // If there is no default, set as default
    if (this.setFirstItemAsDefault && !this.defaultKey) {
      this.defaultKey = key;
    }

    return this;
  }

  getDefaultKey() {
    return this.defaultKey;
  }

  setDefaultKey(key) {
    this.defaultKey = key;

    return this;
  }
}
