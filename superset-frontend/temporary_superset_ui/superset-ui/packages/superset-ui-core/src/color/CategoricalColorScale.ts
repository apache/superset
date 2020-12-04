/* eslint-disable no-dupe-class-members */
import { scaleOrdinal, ScaleOrdinal } from 'd3-scale';
import { ExtensibleFunction } from '../models';
import { ColorsLookup } from './types';
import stringifyAndTrim from './stringifyAndTrim';

// Use type augmentation to correct the fact that
// an instance of CategoricalScale is also a function

interface CategoricalColorScale {
  (x: { toString(): string }): string;
}

class CategoricalColorScale extends ExtensibleFunction {
  colors: string[];

  scale: ScaleOrdinal<{ toString(): string }, string>;

  parentForcedColors?: ColorsLookup;

  forcedColors: ColorsLookup;

  /**
   * Constructor
   * @param {*} colors an array of colors
   * @param {*} parentForcedColors optional parameter that comes from parent
   * (usually CategoricalColorNamespace) and supersede this.forcedColors
   */
  constructor(colors: string[], parentForcedColors?: ColorsLookup) {
    super((value: string) => this.getColor(value));

    this.colors = colors;
    this.scale = scaleOrdinal<{ toString(): string }, string>();
    this.scale.range(colors);
    this.parentForcedColors = parentForcedColors;
    this.forcedColors = {};
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

    return this.scale(cleanedValue);
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

  /**
   * Get a mapping of data values to colors
   * @returns an object where the key is the data value and the value is the hex color code
   */
  getColorMap() {
    const colorMap: { [key: string]: string | undefined } = {};
    this.scale.domain().forEach(value => {
      colorMap[value.toString()] = this.scale(value);
    });

    return {
      ...colorMap,
      ...this.forcedColors,
      ...this.parentForcedColors,
    };
  }

  /**
   * Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.
   */
  copy() {
    const copy = new CategoricalColorScale(this.scale.range(), this.parentForcedColors);
    copy.forcedColors = { ...this.forcedColors };
    copy.domain(this.domain());
    copy.unknown(this.unknown());

    return copy;
  }

  /**
   * Returns the scale's current domain.
   */
  domain(): { toString(): string }[];

  /**
   * Expands the domain to include the specified array of values.
   */
  domain(newDomain: { toString(): string }[]): this;

  domain(newDomain?: { toString(): string }[]): unknown {
    if (typeof newDomain === 'undefined') {
      return this.scale.domain();
    }

    this.scale.domain(newDomain);
    return this;
  }

  /**
   * Returns the scale's current range.
   */
  range(): string[];

  /**
   * Sets the range of the ordinal scale to the specified array of values.
   *
   * The first element in the domain will be mapped to the first element in range, the second domain value to the second range value, and so on.
   *
   * If there are fewer elements in the range than in the domain, the scale will reuse values from the start of the range.
   *
   * @param range Array of range values.
   */
  range(newRange: string[]): this;

  range(newRange?: string[]): unknown {
    if (typeof newRange === 'undefined') {
      return this.scale.range();
    }

    this.colors = newRange;
    this.scale.range(newRange);
    return this;
  }

  /**
   * Returns the current unknown value, which defaults to "implicit".
   */
  unknown(): string | { name: 'implicit' };

  /**
   * Sets the output value of the scale for unknown input values and returns this scale.
   * The implicit value enables implicit domain construction. scaleImplicit can be used as a convenience to set the implicit value.
   *
   * @param value Unknown value to be used or scaleImplicit to set implicit scale generation.
   */
  unknown(value: string | { name: 'implicit' }): this;

  unknown(value?: string | { name: 'implicit' }): unknown {
    if (typeof value === 'undefined') {
      return this.scale.unknown();
    }

    this.scale.unknown(value);
    return this;
  }
}

export default CategoricalColorScale;
