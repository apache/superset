import Plugin from './Plugin';

export default class Preset {
  constructor({
    name = '',
    description = '',
    presets = [],
    plugins = [],
  }) {
    this.name = name;
    this.description = description;
    this.presets = presets;
    this.plugins = plugins;
  }

  install() {
    this.presets.forEach((preset) => {
      preset.install();
    });
    this.plugins.forEach((plugin) => {
      if (plugin instanceof Plugin) {
        plugin.install();
      } else {
        plugin();
      }
    });
    return this;
  }
}
