import { TIME_SHIFT_PATTERN } from '../utils/common';

function cleanValue(value) {
  return String(value).trim()
    .toLowerCase()
    // for superset series that should have the same color
    .split(', ')
    .filter(k => !TIME_SHIFT_PATTERN.test(k))
    .join(', ');
}

const sharedForcedItems = {};

export default class CategoricalColorScale {
  constructor(colors, forcedItems = sharedForcedItems) {
    this.colors = colors;
    this.forcedItems = forcedItems;
    this.seen = {};
    this.fn = value => this.getColor(value);
  }

  getColor(value) {
    const cleanedValue = cleanValue(value);

    const forcedColor = this.forcedItems[cleanedValue];
    if (forcedColor) {
      return forcedColor;
    }

    const seenColor = this.seen[cleanedValue];
    if (seenColor !== undefined) {
      return this.colors[seenColor % this.colors.length];
    }

    const index = Object.keys(this.seen).length;
    this.seen[cleanedValue] = index;
    return this.colors[index % this.colors.length];
  }

  setColor(value, forcedColor) {
    this.forcedItems[value] = forcedColor;
    return this;
  }

  toFunction() {
    return this.fn;
  }
}
