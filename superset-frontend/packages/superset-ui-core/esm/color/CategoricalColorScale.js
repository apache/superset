(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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
import { scaleOrdinal } from 'd3-scale';
import { ExtensibleFunction } from '../models';

import stringifyAndTrim from './stringifyAndTrim';

// Use type augmentation to correct the fact that
// an instance of CategoricalScale is also a function





class CategoricalColorScale extends ExtensibleFunction {








  /**
   * Constructor
   * @param {*} colors an array of colors
   * @param {*} parentForcedColors optional parameter that comes from parent
   * (usually CategoricalColorNamespace) and supersede this.forcedColors
   */
  constructor(colors, parentForcedColors) {
    super((value) => this.getColor(value));this.colors = void 0;this.scale = void 0;this.parentForcedColors = void 0;this.forcedColors = void 0;

    this.colors = colors;
    this.scale = scaleOrdinal();
    this.scale.range(colors);
    this.parentForcedColors = parentForcedColors;
    this.forcedColors = {};
  }

  getColor(value) {
    const cleanedValue = stringifyAndTrim(value);
    const parentColor =
    this.parentForcedColors && this.parentForcedColors[cleanedValue];
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
  setColor(value, forcedColor) {
    this.forcedColors[stringifyAndTrim(value)] = forcedColor;
    return this;
  }

  /**
   * Get a mapping of data values to colors
   * @returns an object where the key is the data value and the value is the hex color code
   */
  getColorMap() {
    const colorMap = {};
    this.scale.domain().forEach((value) => {
      colorMap[value.toString()] = this.scale(value);
    });

    return {
      ...colorMap,
      ...this.forcedColors,
      ...this.parentForcedColors };

  }

  /**
   * Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.
   */
  copy() {
    const copy = new CategoricalColorScale(
    this.scale.range(),
    this.parentForcedColors);

    copy.forcedColors = { ...this.forcedColors };
    copy.domain(this.domain());
    copy.unknown(this.unknown());

    return copy;
  }

  /**
   * Returns the scale's current domain.
   */







  domain(newDomain) {
    if (typeof newDomain === 'undefined') {
      return this.scale.domain();
    }

    this.scale.domain(newDomain);
    return this;
  }

  /**
   * Returns the scale's current range.
   */













  range(newRange) {
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










  unknown(value) {
    if (typeof value === 'undefined') {
      return this.scale.unknown();
    }

    this.scale.unknown(value);
    return this;
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}const _default =
CategoricalColorScale;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(CategoricalColorScale, "CategoricalColorScale", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/CategoricalColorScale.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/CategoricalColorScale.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();