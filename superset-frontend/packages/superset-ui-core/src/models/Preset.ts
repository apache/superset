import Plugin from './Plugin';

export default class Preset {
  name: string;

  description: string;

  presets: Preset[];

  plugins: Plugin[];

  constructor(
    config: {
      name?: string;
      description?: string;
      presets?: Preset[];
      plugins?: Plugin[];
    } = {},
  ) {
    const { name = '', description = '', presets = [], plugins = [] } = config;
    this.name = name;
    this.description = description;
    this.presets = presets;
    this.plugins = plugins;
  }

  register() {
    this.presets.forEach(preset => {
      preset.register();
    });
    this.plugins.forEach(plugin => {
      plugin.register();
    });

    return this;
  }
}
