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
  constructor(colors, sharedForcedItems) {
    this.colors = colors;
    this.sharedForcedItems = sharedForcedItems;
    this.forcedItems = {};
    this.seen = {};
    this.fn = value => this.getColor(value);
  }

  getColor(value) {
    const cleanedValue = cleanValue(value);

    const sharedColor = this.sharedForcedItems && this.sharedForcedItems[cleanedValue];
    if (sharedColor) {
      return sharedColor;
    }

    const forcedColor = this.forcedItems[cleanedValue];
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
    this.forcedItems[value] = forcedColor;
    return this;
  }

  toFunction() {
    return this.fn;
  }
}
