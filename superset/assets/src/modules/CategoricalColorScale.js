import { TIME_SHIFT_PATTERN } from '../utils/common';

function cleanValue(value) {
  return String(value).trim()
    .toLowerCase()
    // for superset series that should have the same color
    .split(', ')
    .filter(k => !TIME_SHIFT_PATTERN.test(k))
    .join(', ');
}

const sharedForced = {};

export default class CategoricalColorScale {
  constructor(colors, forced = sharedForced) {
    this.colors = colors;
    this.forced = forced;
    this.seen = {};
  }

  getColor(value, forcedColor) {
    const cleanedValue = cleanValue(value);

    const specialColor = this.forced[cleanedValue];
    if (specialColor) {
      return specialColor;
    }

    if (forcedColor) {
      this.forced[cleanedValue] = forcedColor;
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
}
