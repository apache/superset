export default class Plugin {
  constructor() {
    this.resetConfig();
  }

  resetConfig() {
    // The child class can set default config
    // by overriding this function.
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
