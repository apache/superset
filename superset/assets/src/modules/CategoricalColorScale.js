import { TIME_SHIFT_PATTERN } from '../utils/common';

export function cleanValue(value) {
  // for superset series that should have the same color
  return String(value).trim()
    .toLowerCase()
    .split(', ')
    .filter(k => !TIME_SHIFT_PATTERN.test(k))
    .join(', ');
}

export default class CategoricalColorScale {
  /**
   * Constructor
   * @param {*} colors an array of colors
   * @param {*} parentForcedColors optional parameter that comes from parent
   * (usually CategoricalColorNamespace) and supersede this.forcedColors
   */
  constructor(colors, parentForcedColors) {
    this.colors = colors;
    this.parentForcedColors = parentForcedColors;
    this.forcedColors = {};
    this.seen = {};
    this.fn = value => this.getColor(value);
  }

  getColor(value) {
    const cleanedValue = cleanValue(value);

    const parentColor = this.parentForcedColors && this.parentForcedColors[cleanedValue];
    if (parentColor) {
      return parentColor;
    }

    const forcedColor = this.forcedColors[cleanedValue];
    if (forcedColor) {
      return forcedColor;
    }

    const seenColor = this.seen[cleanedValue];
    const length = this.colors.length;
    if (seenColor !== undefined) {
      return this.colors[seenColor % length];
    }

    const index = Object.keys(this.seen).length;
    this.seen[cleanedValue] = index;
    return this.colors[index % length];
  }

  /**
   * Enforce specific color for given value
   * @param {*} value value
   * @param {*} forcedColor forcedColor
   */
  setColor(value, forcedColor) {
    this.forcedColors[value] = forcedColor;
    return this;
  }

  toFunction() {
    return this.fn;
  }
}
