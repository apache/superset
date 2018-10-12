import isRequired from '../utils/isRequired';

export default class ColorScheme {
  constructor({
    name = isRequired('name'),
    colors = isRequired('colors'),
    description = '',
  }) {
    this.name = name;
    this.colors = colors;
    this.description = description;
  }
}
