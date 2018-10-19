import isRequired from '../../utils/isRequired';

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
