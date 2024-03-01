import { scaleOrdinal, ScaleOrdinal } from 'd3-scale';
import { ExtensibleFunction } from '../models';
import { ColorsInitLookup, ColorsLookup } from './types';
import stringifyAndTrim from './stringifyAndTrim';
import getSharedLabelColor from './SharedLabelColorSingleton';
import { getAnalogousColors } from './utils';
import { FeatureFlag, isFeatureEnabled } from '../utils';

// Use type augmentation to correct the fact that
// an instance of CategoricalScale is also a function
interface CategoricalColorScale {
  (x: { toString(): string }, y?: number): string;
}

class CategoricalColorScale extends ExtensibleFunction {
  originColors: string[];

  colors: string[];

  scale: ScaleOrdinal<{ toString(): string }, string>;

  forcedColors: ColorsLookup;

  colorUsageCount: Map<string, number>;

  sliceMap: Map<string, string>;

  multiple: number;

  /**
   * Constructor
   * @param {*} colors an array of colors
   * @param {*} forcedColors optional parameter that comes from parent
   * (usually CategoricalColorNamespace)
   */
  constructor(colors: string[], forcedColors: ColorsInitLookup = {}) {
    super((value: string, sliceId?: number) => this.getColor(value, sliceId));
    this.originColors = colors;
    this.colors = colors;
    this.scale = scaleOrdinal<{ toString(): string }, string>();
    this.scale.range(colors);

    // reserve fixed colors in parent map based on their index in the scale
    Object.entries(forcedColors).forEach(([key, value]) => {
      if (typeof value === 'number') {
        // eslint-disable-next-line no-param-reassign
        forcedColors[key] = colors[value % colors.length];
      }
    });

    // forced colors from parent (usually CategoricalColorNamespace)
    this.forcedColors = forcedColors as ColorsLookup;
    // holds the usage count for each color including forced colors from parent
    this.colorUsageCount = this.initColorUsageCounter();
    // holds the values in this specific slice
    this.sliceMap = new Map();
    // holds the multiple value for analogous colors range
    this.multiple = 0;
  }

  /**
   * Increments the color range with analogous colors
   *
   */
  incrementColorRange() {
    const multiple = Math.floor(
      this.domain().length / this.originColors.length,
    );
    // the domain has grown larger than the original range
    // increments the range with analogous colors
    if (multiple > this.multiple) {
      this.multiple = multiple;
      const newRange = getAnalogousColors(this.originColors, multiple);
      this.range(this.originColors.concat(newRange));
      // update the colorUsageCount map with the new colors
      newRange.forEach(color => {
        this.colorUsageCount.set(color, 0);
      });
    }
  }

  /**
   * Initializes the color usage count map
   * @returns a map of color to usage count
   */
  initColorUsageCounter(): Map<string, number> {
    const colorUsageCount = new Map(this.colors.map(color => [color, 0]));
    // add forced colors to the usage count map
    // helps reducing conflicts but increases randomness
    Object.values(this.forcedColors).forEach(color => {
      const count = colorUsageCount.get(color) || 0;
      colorUsageCount.set(color, count + 1);
    });
    return colorUsageCount;
  }

  getColor(value?: string, sliceId?: number): string {
    const cleanedValue = stringifyAndTrim(value);
    const sharedLabelColor = getSharedLabelColor();
    const sharedColorMap = sharedLabelColor.getColorMap();
    const sharedColor = sharedColorMap.get(cleanedValue);
    const forcedColor = this.forcedColors?.[cleanedValue] || sharedColor;
    let color = forcedColor || this.scale(cleanedValue);

    // a forced color will always be used independently of the usage count
    if (!forcedColor) {
      if (isFeatureEnabled(FeatureFlag.UseAnalagousColors)) {
        this.incrementColorRange();
      }
      if (this.isColorUsed(color)) {
        // color was used in this slice already
        // fallback to least used color
        color = this.getNextAvailableColor(color);
      }
    }

    // increment the usage count for the color
    this.incrementColorUsage(color);

    // store the value+color in the shared map for dashboard consistency
    sharedLabelColor.addSlice(cleanedValue, color, sliceId);

    // keep track of values in this slice
    this.sliceMap.set(cleanedValue, color);

    return color;
  }

  /**
   *
   * @param color
   * @returns whether the color is used in this slice
   */
  isColorUsed(color: string): boolean {
    return Array.from(this.sliceMap.values()).includes(color);
  }

  /**
   * Lower chances of color collision by returning the least used color
   * Checks across colors of current slice and forced colors (all slices from parent)
   *
   * @param excludeColor
   * @returns the least used color that is not the excluded color
   */
  getNextAvailableColor(excludeColor: string) {
    // sort the colors by count, then exclude the specified color
    const sortedColors = [...this.colorUsageCount.entries()]
      .sort((a, b) => a[1] - b[1])
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([color, _]) => color !== excludeColor);
    const color = sortedColors[0][0];

    return color;
  }

  incrementColorUsage(color: string) {
    const currentCount = this.colorUsageCount.get(color) || 0;
    this.colorUsageCount.set(color, currentCount + 1);
  }

  /**
   * Get a mapping of data values to colors
   * @returns an object where the key is the data value and the value is the hex color code
   */
  getColorMap() {
    const colorMap = {};
    this.scale.domain().forEach(value => {
      colorMap[value.toString()] = this.scale(value);
    });
    return { ...colorMap, ...this.forcedColors };
  }

  /**
   * Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.
   */
  copy() {
    const copy = new CategoricalColorScale(
      this.scale.range(),
      this.forcedColors,
    );
    copy.forcedColors = { ...this.forcedColors };
    copy.colorUsageCount = new Map(this.colorUsageCount);
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
   * @param newRange Array of range values.
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
