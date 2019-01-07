import { ExtensibleFunction } from '@superset-ui/core';
import { ColorsLookup } from './types';
import stringifyAndTrim from './stringifyAndTrim';

export default class CategoricalColorScale extends ExtensibleFunction {
  colors: string[];
  parentForcedColors?: ColorsLookup;
  forcedColors: ColorsLookup;
  seen: { [key: string]: number };

  /**
   * Constructor
   * @param {*} colors an array of colors
   * @param {*} parentForcedColors optional parameter that comes from parent
   * (usually CategoricalColorNamespace) and supersede this.forcedColors
   */
  constructor(colors: string[], parentForcedColors?: ColorsLookup) {
    super((value: string) => this.getColor(value));
    this.colors = colors;
    this.parentForcedColors = parentForcedColors;
    this.forcedColors = {};
    this.seen = {};
  }

  getColor(value?: string) {
    const cleanedValue = stringifyAndTrim(value);

    const parentColor = this.parentForcedColors && this.parentForcedColors[cleanedValue];
    if (parentColor) {
      return parentColor;
    }

    const forcedColor = this.forcedColors[cleanedValue];
    if (forcedColor) {
      return forcedColor;
    }

    const seenColor = this.seen[cleanedValue];
    const { length } = this.colors;
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
  setColor(value: string, forcedColor: string) {
    this.forcedColors[stringifyAndTrim(value)] = forcedColor;

    return this;
  }
}
