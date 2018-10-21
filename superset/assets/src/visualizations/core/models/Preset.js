export default class Preset {
  constructor({
    name = '',
    description = '',
    presets = [],
    plugins = [],
  } = {}) {
    this.name = name;
    this.description = description;
    this.presets = presets;
    this.plugins = plugins;
  }

  register() {
    this.presets.forEach((preset) => {
      preset.register();
    });
    this.plugins.forEach((plugin) => {
      plugin.register();
    });
    return this;
  }
}
