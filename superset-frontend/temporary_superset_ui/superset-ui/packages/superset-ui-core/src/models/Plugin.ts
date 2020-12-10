interface PlainObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  configure(config: PlainObject, replace = false) {
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
