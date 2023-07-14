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

/* eslint-disable no-dupe-class-members */
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

  parentForcedColors: ColorsLookup;

  forcedColors: ColorsLookup;

  multiple: number;

  /**
   * Constructor
   * @param {*} colors an array of colors
   * @param {*} parentForcedColors optional parameter that comes from parent
   * (usually CategoricalColorNamespace) and supersede this.forcedColors
   */
  constructor(colors: string[], parentForcedColors: ColorsInitLookup = {}) {
    super((value: string, sliceId?: number) => this.getColor(value, sliceId));

    this.originColors = colors;
    this.colors = colors;
    this.scale = scaleOrdinal<{ toString(): string }, string>();
    this.scale.range(colors);

    // reserve fixed colors in parent map based on their index in the scale
    Object.entries(parentForcedColors).forEach(([key, value]) => {
      if (typeof value === 'number') {
        // eslint-disable-next-line no-param-reassign
        parentForcedColors[key] = colors[value % colors.length];
      }
    });

    // all indexes have been replaced by a fixed color
    this.parentForcedColors = parentForcedColors as ColorsLookup;
    this.forcedColors = {};
    this.multiple = 0;
  }

  removeSharedLabelColorFromRange(
    sharedColorMap: Map<string, string>,
    cleanedValue: string,
  ) {
    // make sure we don't overwrite the origin colors
    const updatedRange = new Set(this.originColors);
    // remove the color option from shared color
    sharedColorMap.forEach((value: string, key: string) => {
      if (key !== cleanedValue) {
        updatedRange.delete(value);
      }
    });
    // remove the color option from forced colors
    Object.entries(this.parentForcedColors).forEach(([key, value]) => {
      if (key !== cleanedValue) {
        updatedRange.delete(value);
      }
    });
    this.range(updatedRange.size > 0 ? [...updatedRange] : this.originColors);
  }

  getColor(value?: string, sliceId?: number) {
    const cleanedValue = stringifyAndTrim(value);
    const sharedLabelColor = getSharedLabelColor();
    const sharedColorMap = sharedLabelColor.getColorMap();
    const sharedColor = sharedColorMap.get(cleanedValue);

    // priority: parentForcedColors > forcedColors > labelColors
    let color =
      this.parentForcedColors?.[cleanedValue] ||
      this.forcedColors?.[cleanedValue] ||
      sharedColor;

    if (isFeatureEnabled(FeatureFlag.USE_ANALAGOUS_COLORS)) {
      const multiple = Math.floor(
        this.domain().length / this.originColors.length,
      );
      if (multiple > this.multiple) {
        this.multiple = multiple;
        const newRange = getAnalogousColors(this.originColors, multiple);
        this.range(this.originColors.concat(newRange));
      }
    }
    const newColor = this.scale(cleanedValue);
    if (!color) {
      color = newColor;
      if (isFeatureEnabled(FeatureFlag.AVOID_COLORS_COLLISION)) {
        this.removeSharedLabelColorFromRange(sharedColorMap, cleanedValue);
        color = this.scale(cleanedValue);
      }
    }

    sharedLabelColor.addSlice(cleanedValue, color, sliceId);

    return color;
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
    const copy = new CategoricalColorScale(
      this.scale.range(),
      this.parentForcedColors,
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
