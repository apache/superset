import isRequired from '../utils/isRequired';

export const CATEGORICAL = 1;
export const SEQUENTIAL = 2;
export const DIVERGING = 3;

export default class ColorScheme {
  constructor({
    name = isRequired('name'),
    type = isRequired('type'),
    colors = isRequired('colors'),
    description = '',
  }) {
    this.name = name;
    this.type = type;
    this.colors = colors;
    this.description = description;
  }

  isContinuous() {
    return this.type === SEQUENTIAL || this.type === DIVERGING;
  }
}
