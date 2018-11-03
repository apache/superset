import { isRequired } from '@superset-ui/core';

export default class ColorScheme {
  constructor({
    name = isRequired('name'),
    label,
    colors = isRequired('colors'),
    description = '',
  }) {
    this.name = name;
    this.label = label || name;
    this.colors = colors;
    this.description = description;
  }
}
