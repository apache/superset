export default class Preset {
  constructor({ name, namespace = '', presets = [], plugins = [] }) {
    this.name = name;
    this.namespace = namespace;
    this.presets = presets
      .map(preset => (preset instanceof Preset) ? preset : new Preset(preset));
    this.plugins = plugins;
  }

  expandPlugins() {
    const allPlugins = {};
    const addPlugin = (plugin) => {
      const key = `${this.namespace}${plugin.name}`;
      allPlugins[key] = plugin;
    };
    this.presets
      .map(preset => preset.expandPlugins())
      .forEach((plugins) => {
        plugins.forEach(addPlugin);
      });
    this.plugins.forEach(addPlugin);
    return allPlugins;
  }

  install() {
    const allPlugins = this.expandPlugins();
    Object.keys(allPlugins)
      .forEach((key) => {
        allPlugins[key].install(key);
      });
    return this;
  }
}
