import Registry, { RegistryConfig } from './Registry';

export interface RegistryWithDefaultKeyConfig extends RegistryConfig {
  initialDefaultKey?: string;
  setFirstItemAsDefault?: boolean;
}

export default class RegistryWithDefaultKey<V> extends Registry<V> {
  initialDefaultKey?: string;
  defaultKey?: string;
  setFirstItemAsDefault: boolean;

  constructor(config: RegistryWithDefaultKeyConfig = {}) {
    super(config);
    const { initialDefaultKey = undefined, setFirstItemAsDefault = false } = config;
    this.initialDefaultKey = initialDefaultKey;
    this.defaultKey = initialDefaultKey;
    this.setFirstItemAsDefault = setFirstItemAsDefault;
  }

  clear() {
    super.clear();
    this.defaultKey = this.initialDefaultKey;

    return this;
  }

  get(key?: string) {
    const targetKey = key || this.defaultKey;

    return targetKey ? super.get(targetKey) : undefined;
  }

  registerValue(key: string, value: V) {
    super.registerValue(key, value);
    // If there is no default, set as default
    if (this.setFirstItemAsDefault && !this.defaultKey) {
      this.defaultKey = key;
    }

    return this;
  }

  registerLoader(key: string, loader: () => V | Promise<V>) {
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

  setDefaultKey(key: string) {
    this.defaultKey = key;

    return this;
  }

  clearDefaultKey() {
    this.defaultKey = undefined;

    return this;
  }
}
