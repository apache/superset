interface PlainObject {
  [key: string]: any;
}

export default class Plugin {
  config: PlainObject;

  constructor() {
    this.config = {};
  }

  resetConfig() {
    // The child class can set default config
    // by overriding this function.
    this.config = {};

    return this;
  }

  configure(config: PlainObject, replace: boolean = false) {
    this.config = replace ? config : { ...this.config, ...config };

    return this;
  }

  register() {
    return this;
  }

  unregister() {
    return this;
  }
}
