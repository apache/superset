export default class Plugin {
  constructor() {
    this.resetConfig();
  }

  resetConfig() {
    // For the extended class,
    // can set default config in this function.
    this.config = {};
    return this;
  }

  configure(config, replace = false) {
    if (replace) {
      this.config = config;
    } else {
      this.config = { ...this.config, ...config };
    }
    return this;
  }

  register() {
    return this;
  }
}
