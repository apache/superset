export interface ColorSchemeConfig {
  colors: string[];
  description?: string;
  id: string;
  label?: string;
  isDefault?: boolean;
}

export default class ColorScheme {
  colors: string[];

  description: string;

  id: string;

  label: string;

  isDefault?: boolean;

  constructor({ colors, description = '', id, label, isDefault }: ColorSchemeConfig) {
    this.id = id;
    this.label = label ?? id;
    this.colors = colors;
    this.description = description;
    this.isDefault = isDefault;
  }
}
