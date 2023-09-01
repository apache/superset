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

import { ScaleOrdinal } from 'd3-scale';
import {
  CategoricalColorScale,
  FeatureFlag,
  getSharedLabelColor,
} from '@superset-ui/core';

describe('CategoricalColorScale', () => {
  it('exists', () => {
    expect(CategoricalColorScale !== undefined).toBe(true);
  });

  describe('new CategoricalColorScale(colors, parentForcedColors)', () => {
    it('can create new scale when parentForcedColors is not given', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale).toBeInstanceOf(CategoricalColorScale);
    });
    it('can create new scale when parentForcedColors is given', () => {
      const parentForcedColors = {};
      const scale = new CategoricalColorScale(
        ['blue', 'red', 'green'],
        parentForcedColors,
      );
      expect(scale).toBeInstanceOf(CategoricalColorScale);
      expect(scale.parentForcedColors).toBe(parentForcedColors);
    });

    it('can refer to colors based on their index', () => {
      const parentForcedColors = { pig: 1, horse: 5 };
      const scale = new CategoricalColorScale(
        ['blue', 'red', 'green'],
        parentForcedColors,
      );
      expect(scale.getColor('pig')).toEqual('red');
      expect(parentForcedColors.pig).toEqual('red');

      // can loop around the scale
      expect(scale.getColor('horse')).toEqual('green');
      expect(parentForcedColors.horse).toEqual('green');
    });
  });

  describe('.getColor(value)', () => {
    it('returns same color for same value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const c1 = scale.getColor('pig');
      const c2 = scale.getColor('horse');
      const c3 = scale.getColor('pig');
      scale.getColor('cow');
      const c5 = scale.getColor('horse');

      expect(c1).toBe(c3);
      expect(c2).toBe(c5);
    });
    it('returns different color for consecutive items', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const c1 = scale.getColor('pig');
      const c2 = scale.getColor('horse');
      const c3 = scale.getColor('cat');

      expect(c1).not.toBe(c2);
      expect(c2).not.toBe(c3);
      expect(c3).not.toBe(c1);
    });
    it('recycles colors when number of items exceed available colors', () => {
      window.featureFlags = {
        [FeatureFlag.USE_ANALAGOUS_COLORS]: false,
      };
      const colorSet: { [key: string]: number } = {};
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const colors = [
        scale.getColor('pig'),
        scale.getColor('horse'),
        scale.getColor('cat'),
        scale.getColor('cow'),
        scale.getColor('donkey'),
        scale.getColor('goat'),
      ];
      colors.forEach(color => {
        if (colorSet[color]) {
          colorSet[color] += 1;
        } else {
          colorSet[color] = 1;
        }
      });
      expect(Object.keys(colorSet)).toHaveLength(3);
      ['blue', 'red', 'green'].forEach(color => {
        expect(colorSet[color]).toBe(2);
      });
    });
    it('get analogous colors when number of items exceed available colors', () => {
      window.featureFlags = {
        [FeatureFlag.USE_ANALAGOUS_COLORS]: true,
      };
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('pig');
      scale.getColor('horse');
      scale.getColor('cat');
      scale.getColor('cow');
      scale.getColor('donkey');
      scale.getColor('goat');
      expect(scale.range()).toHaveLength(6);
    });

    it('should remove shared color from range if avoid colors collision enabled', () => {
      window.featureFlags = {
        [FeatureFlag.AVOID_COLORS_COLLISION]: true,
      };
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const color1 = scale.getColor('a', 1);
      expect(scale.range()).toHaveLength(3);
      const color2 = scale.getColor('a', 2);
      expect(color1).toBe(color2);
      scale.getColor('b', 2);
      expect(scale.range()).toHaveLength(2);
      scale.getColor('c', 2);
      expect(scale.range()).toHaveLength(1);
    });
    window.featureFlags = {
      [FeatureFlag.AVOID_COLORS_COLLISION]: false,
    };
  });
  describe('.setColor(value, forcedColor)', () => {
    it('overrides default color', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.setColor('pig', 'pink');
      expect(scale.getColor('pig')).toBe('pink');
    });
    it('does not override parentForcedColors', () => {
      const scale1 = new CategoricalColorScale(['blue', 'red', 'green']);
      scale1.setColor('pig', 'black');
      const scale2 = new CategoricalColorScale(
        ['blue', 'red', 'green'],
        scale1.forcedColors,
      );
      scale2.setColor('pig', 'pink');
      expect(scale1.getColor('pig')).toBe('black');
      expect(scale2.getColor('pig')).toBe('black');
    });
    it('returns the scale', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const output = scale.setColor('pig', 'pink');
      expect(scale).toBe(output);
    });
  });
  describe('.getColorMap()', () => {
    it('returns correct mapping and parentForcedColors and forcedColors are specified', () => {
      const scale1 = new CategoricalColorScale(['blue', 'red', 'green']);
      scale1.setColor('cow', 'black');
      const scale2 = new CategoricalColorScale(
        ['blue', 'red', 'green'],
        scale1.forcedColors,
      );
      scale2.setColor('pig', 'pink');
      scale2.getColor('cow');
      scale2.getColor('pig');
      scale2.getColor('horse');
      expect(scale2.getColorMap()).toEqual({
        cow: 'black',
        pig: 'pink',
        horse: 'green',
      });
    });
  });

  describe('.copy()', () => {
    it('returns a copy', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const copy = scale.copy();
      expect(copy).not.toBe(scale);
      expect(copy('cat')).toEqual(scale('cat'));
      expect(copy.domain()).toEqual(scale.domain());
      expect(copy.range()).toEqual(scale.range());
      expect(copy.unknown()).toEqual(scale.unknown());
    });
  });
  describe('.domain()', () => {
    it('when called without argument, returns domain', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('pig');
      expect(scale.domain()).toEqual(['pig']);
    });
    it('when called with argument, sets domain', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.domain(['dog', 'pig', 'cat']);
      expect(scale('pig')).toEqual('red');
    });
  });
  describe('.range()', () => {
    it('when called without argument, returns range', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale.range()).toEqual(['blue', 'red', 'green']);
    });
    it('when called with argument, sets range', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.range(['pink', 'gray', 'yellow']);
      expect(scale.range()).toEqual(['pink', 'gray', 'yellow']);
    });
  });
  describe('.unknown()', () => {
    it('when called without argument, returns output for unknown value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.unknown('#666');
      expect(scale.unknown()).toEqual('#666');
    });
    it('when called with argument, sets output for unknown value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.unknown('#222');
      expect(scale.unknown()).toEqual('#222');
    });
  });

  describe('a CategoricalColorScale instance is also a color function itself', () => {
    it('scale(value) returns color similar to calling scale.getColor(value)', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale.getColor('pig')).toBe(scale('pig'));
      expect(scale.getColor('cat')).toBe(scale('cat'));
    });
  });

  describe("is compatible with D3's ScaleOrdinal", () => {
    it('passes type check', () => {
      const scale: ScaleOrdinal<{ toString(): string }, string> =
        new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale('pig')).toBe('blue');
    });
  });

  describe('.removeSharedLabelColorFromRange(colorMap, cleanedValue)', () => {
    it('should remove shared color from range', () => {
      const scale = new CategoricalColorScale(['blue', 'green', 'red']);
      expect(scale.range()).toEqual(['blue', 'green', 'red']);

      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.clear();
      const colorMap = sharedLabelColor.getColorMap();
      sharedLabelColor.addSlice('cow', 'blue', 1);
      scale.removeSharedLabelColorFromRange(colorMap, 'pig');
      expect(scale.range()).toEqual(['green', 'red']);
      scale.removeSharedLabelColorFromRange(colorMap, 'cow');
      expect(scale.range()).toEqual(['blue', 'green', 'red']);
      sharedLabelColor.clear();
    });

    it('recycles colors when all colors are in sharedLabelColor', () => {
      const scale = new CategoricalColorScale(['blue', 'green', 'red']);
      expect(scale.range()).toEqual(['blue', 'green', 'red']);
      const sharedLabelColor = getSharedLabelColor();
      const colorMap = sharedLabelColor.getColorMap();
      sharedLabelColor.addSlice('cow', 'blue', 1);
      sharedLabelColor.addSlice('pig', 'red', 1);
      sharedLabelColor.addSlice('horse', 'green', 1);
      scale.removeSharedLabelColorFromRange(colorMap, 'goat');
      expect(scale.range()).toEqual(['blue', 'green', 'red']);
      sharedLabelColor.clear();
    });

    it('should remove parentForcedColors from range', () => {
      const parentForcedColors = { house: 'blue', cow: 'red' };
      const scale = new CategoricalColorScale(
        ['blue', 'red', 'green'],
        parentForcedColors,
      );
      const sharedLabelColor = getSharedLabelColor();
      sharedLabelColor.clear();
      const colorMap = sharedLabelColor.getColorMap();
      scale.removeSharedLabelColorFromRange(colorMap, 'pig');
      expect(scale.range()).toEqual(['green']);
      scale.removeSharedLabelColorFromRange(colorMap, 'cow');
      expect(scale.range()).toEqual(['red', 'green']);
      sharedLabelColor.clear();
    });
  });
});
