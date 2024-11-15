/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { scaleOrdinal, ScaleOrdinal } from 'd3-scale';
import { ExtensibleFunction } from '../models';
import { ColorsInitLookup, ColorsLookup } from './types';
import stringifyAndTrim from './stringifyAndTrim';
import getLabelsColorMap, {
  LabelsColorMapSource,
} from './LabelsColorMapSingleton';
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

  labelsColorMapInstance: ReturnType<typeof getLabelsColorMap>;

  chartLabelsColorMap: Map<string, string>;

  multiple: number;

  /**
   * Constructor
   * @param {*} colors an array of colors
   * @param {*} forcedColors optional parameter that comes from parent
   * @param {*} appliedColorScheme the color scheme applied to the chart
   *
   */
  constructor(
    colors: string[],
    forcedColors: ColorsInitLookup = {},
    appliedColorScheme?: string,
  ) {
    super((value: string, sliceId?: number) =>
      this.getColor(value, sliceId, appliedColorScheme),
    );
    // holds original color scheme colors
    this.originColors = colors;
    // holds the extended color range (includes analagous colors)
    this.colors = colors;
    // holds the values of this specific slice (label+color)
    this.chartLabelsColorMap = new Map();
    // shared color map instance (when context is shared, i.e. dashboard)
    this.labelsColorMapInstance = getLabelsColorMap();
    // holds the multiple value for analogous colors range
    this.multiple = 0;

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
    // currently used in dashboards to set custom label colors
    this.forcedColors = forcedColors as ColorsLookup;
  }

  /**
   * Increment the color range with analogous colors
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
      const extendedColors = this.originColors.concat(newRange);

      this.range(extendedColors);
      this.colors = extendedColors;
    }
  }

  /**
   * Get the color for a given value
   *
   * @param value the value of a label to get the color for
   * @param sliceId the ID of the current chart
   * @param appliedColorScheme the color scheme applied to the chart
   * @returns the color or the next available color
   */
  getColor(
    value?: string,
    sliceId?: number,
    appliedColorScheme?: string,
  ): string {
    const cleanedValue = stringifyAndTrim(value);
    // priority: forced color (aka custom label colors) > shared color > scale color
    const forcedColor = this.forcedColors?.[cleanedValue];
    const { source } = this.labelsColorMapInstance;
    const currentColorMap =
      source === LabelsColorMapSource.Dashboard
        ? this.labelsColorMapInstance.getColorMap()
        : this.chartLabelsColorMap;
    const isExistingLabel = currentColorMap.has(cleanedValue);
    let color =
      forcedColor ||
      (isExistingLabel
        ? (currentColorMap.get(cleanedValue) as string)
        : this.scale(cleanedValue));

    // a forced color will always be used independently of the usage count
    if (!forcedColor && !isExistingLabel) {
      if (isFeatureEnabled(FeatureFlag.UseAnalagousColors)) {
        this.incrementColorRange();
      }
      if (
        // feature flag to be deprecated (will become standard behaviour)
        isFeatureEnabled(FeatureFlag.AvoidColorsCollision) &&
        this.isColorUsed(color)
      ) {
        // fallback to least used color
        color = this.getNextAvailableColor(color);
      }
    }

    // keep track of values in this slice
    this.chartLabelsColorMap.set(cleanedValue, color);

    // store the value+color in the LabelsColorMapSingleton
    if (sliceId) {
      this.labelsColorMapInstance.addSlice(
        cleanedValue,
        color,
        sliceId,
        appliedColorScheme,
      );
    }
    return color;
  }

  /**
   * Verify if a color is used in this slice
   *
   * @param color
   * @returns true if the color is used in this slice
   */
  isColorUsed(color: string): boolean {
    return this.getColorUsageCount(color) > 0;
  }

  /**
   * Get the count of the color usage in this slice
   *
   * @param sliceId the ID of the current slice
   * @param color the color to check
   * @returns the count of the color usage in this slice
   */
  getColorUsageCount(color: string): number {
    return Array.from(this.chartLabelsColorMap.values()).filter(
      value => value === color,
    ).length;
  }

  /**
   * Lower chances of color collision by returning the least used color.
   * Checks across colors of current slice within LabelsColorMapSingleton.
   *
   * @param currentColor the current color
   * @returns the least used color that is not the excluded color
   */
  getNextAvailableColor(currentColor: string): string {
    const currentIndex = this.colors.indexOf(currentColor);

    // Precompute color usage counts for all colors
    const colorUsageCounts = new Map(
      this.colors.map(color => [color, this.getColorUsageCount(color)]),
    );

    const currentColorCount = colorUsageCounts.get(currentColor) || 0;

    // Determine adjusted score (usage count + penalty)
    const calculateScore = (color: string): number => {
      const usageCount = colorUsageCounts.get(color) || 0;
      const targetIndex = this.colors.indexOf(color);
      const penalty =
        currentIndex !== -1 && targetIndex !== -1
          ? Math.max(0, 2 - Math.abs(currentIndex - targetIndex))
          : 0;
      return usageCount + penalty;
    };

    // Filter out the current color and calculate scores for others
    const otherColors = this.colors.filter(color => color !== currentColor);
    const hasNoneAvailable = otherColors.every(
      color => (colorUsageCounts.get(color) || 0) >= currentColorCount,
    );

    // Fallback to currentColor if no better option is available
    if (!otherColors.length || hasNoneAvailable) {
      return currentColor;
    }

    // Find the color with the minimum score
    return otherColors.reduce((bestColor, color) => {
      const bestScore = calculateScore(bestColor);
      const currentScore = calculateScore(color);
      return currentScore < bestScore ? color : bestColor;
    }, currentColor);
  }

  /**
   * Enforce specific color for a given value at the scale level
   * Overrides any existing color and forced color for the given value
   *
   * @param {*} value value
   * @param {*} forcedColor forcedColor
   * @returns {CategoricalColorScale}
   */
  setColor(value: string, forcedColor: string) {
    this.forcedColors[stringifyAndTrim(value)] = forcedColor;
    return this;
  }

  /**
   * Get a mapping of data values to colors
   *
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
    };
  }

  /**
   * Return an exact copy of this scale.
   * Changes to this scale will not affect the returned scale and vice versa.
   *
   * @returns {CategoricalColorScale} A copy of this scale.
   */
  copy() {
    const copy = new CategoricalColorScale(
      this.scale.range(),
      this.forcedColors,
    );
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
