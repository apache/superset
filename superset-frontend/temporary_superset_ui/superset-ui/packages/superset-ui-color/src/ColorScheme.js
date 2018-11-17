import { isRequired } from '@superset-ui/core';

export default class ColorScheme {
  constructor({ colors = isRequired('colors'), description = '', id = isRequired('id'), label }) {
    this.id = id;
    this.label = label || id;
    this.colors = colors;
    this.description = description;
  }
}
