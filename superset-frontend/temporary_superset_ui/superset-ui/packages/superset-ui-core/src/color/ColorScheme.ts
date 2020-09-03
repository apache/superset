export interface ColorSchemeConfig {
  colors: string[];
  description?: string;
  id: string;
  label?: string;
}

export default class ColorScheme {
  colors: string[];

  description: string;

  id: string;

  label: string;

  constructor(config: ColorSchemeConfig) {
    const { colors, description = '', id, label } = config;
    this.id = id;
    this.label = label ?? id;
    this.colors = colors;
    this.description = description;
  }
}
