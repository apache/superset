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
import { CategoricalColorScale, FeatureFlag } from '@superset-ui/core';

describe('CategoricalColorScale', () => {
  beforeEach(() => {
    window.featureFlags = {};
  });

  it('exists', () => {
    expect(CategoricalColorScale !== undefined).toBe(true);
  });

  describe('new CategoricalColorScale(colors, forcedColors)', () => {
    it('can create new scale when forcedColors is not given', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale).toBeInstanceOf(CategoricalColorScale);
    });
    it('can create new scale when forcedColors is given', () => {
      const forcedColors = {};
      const scale = new CategoricalColorScale(
        ['blue', 'red', 'green'],
        forcedColors,
      );
      expect(scale).toBeInstanceOf(CategoricalColorScale);
      expect(scale.forcedColors).toBe(forcedColors);
    });

    it('can refer to colors based on their index', () => {
      const forcedColors = { pig: 1, horse: 5 };
      const scale = new CategoricalColorScale(
        ['blue', 'red', 'green'],
        forcedColors,
      );
      expect(scale.getColor('pig')).toEqual('red');
      expect(forcedColors.pig).toEqual('red');

      // can loop around the scale
      expect(scale.getColor('horse')).toEqual('green');
      expect(forcedColors.horse).toEqual('green');
    });
  });

  describe('.getColor(value, sliceId)', () => {
    let scale: CategoricalColorScale;
    let addSliceSpy: jest.SpyInstance<
      void,
      [label: string, color: string, sliceId: number, colorScheme?: string]
    >;
    let getNextAvailableColorSpy: jest.SpyInstance<
      string,
      [currentColor: string]
    >;

    beforeEach(() => {
      scale = new CategoricalColorScale(['blue', 'red', 'green']);
      // Spy on the addSlice method of labelsColorMapInstance
      addSliceSpy = jest.spyOn(scale.labelsColorMapInstance, 'addSlice');
      getNextAvailableColorSpy = jest
        .spyOn(scale, 'getNextAvailableColor')
        .mockImplementation(color => color);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns same color for same value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green'], {
        pig: 'red',
        horse: 'green',
      });
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
        [FeatureFlag.UseAnalagousColors]: true,
      };
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('pig');
      scale.getColor('horse');
      scale.getColor('cat');
      scale.getColor('cow');
      scale.getColor('donkey');
      scale.getColor('goat');
      expect(scale.range()).toHaveLength(9);
    });
    it('adds the color and value to chartLabelsColorMap and calls addSlice', () => {
      const value = 'testValue';
      const sliceId = 123;
      const colorScheme = 'preset';

      expect(scale.chartLabelsColorMap.has(value)).toBe(false);

      scale.getColor(value, sliceId, colorScheme);

      expect(scale.chartLabelsColorMap.has(value)).toBe(true);
      expect(scale.chartLabelsColorMap.get(value)).toBeDefined();

      expect(addSliceSpy).toHaveBeenCalledWith(
        value,
        expect.any(String),
        sliceId,
        colorScheme,
      );

      const expectedColor = scale.chartLabelsColorMap.get(value);
      const returnedColor = scale.getColor(value, sliceId);
      expect(returnedColor).toBe(expectedColor);
    });
    it('conditionally calls getNextAvailableColor', () => {
      window.featureFlags = {
        [FeatureFlag.AvoidColorsCollision]: true,
      };

      scale.getColor('testValue1');
      scale.getColor('testValue2');
      scale.getColor('testValue1');
      scale.getColor('testValue3');
      scale.getColor('testValue4');

      expect(getNextAvailableColorSpy).toHaveBeenCalledWith('blue');

      getNextAvailableColorSpy.mockClear();

      window.featureFlags = {
        [FeatureFlag.AvoidColorsCollision]: false,
      };

      scale.getColor('testValue3');

      expect(getNextAvailableColorSpy).not.toHaveBeenCalled();
    });
  });

  describe('.setColor(value, forcedColor)', () => {
    it('overrides default color', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.setColor('pig', 'pink');
      expect(scale.getColor('pig')).toBe('pink');
    });
    it('does override forcedColors', () => {
      const scale1 = new CategoricalColorScale(['blue', 'red', 'green']);
      scale1.setColor('pig', 'black');

      const scale2 = new CategoricalColorScale(['blue', 'red', 'green']);
      scale2.setColor('pig', 'pink');
      expect(scale2.getColor('pig')).toBe('pink');
      expect(scale1.getColor('pig')).toBe('black');
    });
    it('returns the scale', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const output = scale.setColor('pig', 'pink');
      expect(scale).toBe(output);
    });
  });
  describe('.getColorMap()', () => {
    it('returns correct mapping using least used color', () => {
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
        horse: 'blue', // least used color
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
    it('scale(value) returns same color for same value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale.getColor('pig')).toBe('blue');
      expect(scale('pig')).toBe('blue');
      expect(scale.getColor('cat')).toBe('red');
      expect(scale('cat')).toBe('red');
    });
  });

  describe('.getNextAvailableColor(currentColor)', () => {
    it('returns the current color if it is the least used or equally used among colors', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('cat');
      scale.getColor('dog');

      // Since 'green' hasn't been used, it's considered the least used.
      expect(scale.getNextAvailableColor('blue')).toBe('green');
    });

    it('handles cases where all colors are equally used and returns the current color', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('cat'); // blue
      scale.getColor('dog'); // red
      scale.getColor('fish'); // green
      // All colors used once, so the function should return the current color
      expect(scale.getNextAvailableColor('red')).toBe('red');
    });

    it('returns the least used color accurately even when some colors are used more frequently', () => {
      const scale = new CategoricalColorScale([
        'blue',
        'red',
        'green',
        'yellow',
      ]);
      scale.getColor('cat'); // blue
      scale.getColor('dog'); // red
      scale.getColor('frog'); // green
      scale.getColor('fish'); // yellow
      scale.getColor('goat'); // blue
      scale.getColor('horse'); // red
      scale.getColor('pony'); // green

      // Yellow is the least used color, so it should be returned.
      expect(scale.getNextAvailableColor('blue')).toBe('yellow');
    });
  });

  describe('.isColorUsed(color)', () => {
    it('returns true if the color is already used, false otherwise', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      // Initially, no color is used
      expect(scale.isColorUsed('blue')).toBe(false);
      expect(scale.isColorUsed('red')).toBe(false);
      expect(scale.isColorUsed('green')).toBe(false);

      scale.getColor('item1');

      // Now, 'blue' is used, but 'red' and 'green' are not
      expect(scale.isColorUsed('blue')).toBe(true);
      expect(scale.isColorUsed('red')).toBe(false);
      expect(scale.isColorUsed('green')).toBe(false);

      // Simulate using the 'red' color
      scale.getColor('item2'); // Assigns 'red' to 'item2'

      // Now, 'blue' and 'red' are used
      expect(scale.isColorUsed('blue')).toBe(true);
      expect(scale.isColorUsed('red')).toBe(true);
      expect(scale.isColorUsed('green')).toBe(false);
    });
  });

  describe('.getColorUsageCount(color)', () => {
    it('accurately counts the occurrences of a specific color', () => {
      const scale = new CategoricalColorScale([
        'blue',
        'red',
        'green',
        'yellow',
      ]);
      // No colors are used initially
      expect(scale.getColorUsageCount('blue')).toBe(0);
      expect(scale.getColorUsageCount('red')).toBe(0);
      expect(scale.getColorUsageCount('green')).toBe(0);
      expect(scale.getColorUsageCount('yellow')).toBe(0);

      // Simulate using colors
      scale.getColor('item1');
      scale.getColor('item2');
      scale.getColor('item1');

      // Check the counts after using the colors
      expect(scale.getColorUsageCount('blue')).toBe(1);
      expect(scale.getColorUsageCount('red')).toBe(1);
      expect(scale.getColorUsageCount('green')).toBe(0);
      expect(scale.getColorUsageCount('yellow')).toBe(0);

      // Simulate using colors more
      scale.getColor('item3');
      scale.getColor('item4');
      scale.getColor('item3');

      // Final counts
      expect(scale.getColorUsageCount('blue')).toBe(1);
      expect(scale.getColorUsageCount('red')).toBe(1);
      expect(scale.getColorUsageCount('green')).toBe(1);
      expect(scale.getColorUsageCount('yellow')).toBe(1);
    });
  });

  describe("is compatible with D3's ScaleOrdinal", () => {
    it('passes type check', () => {
      const scale: ScaleOrdinal<{ toString(): string }, string> =
        new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale('pig')).toBe('blue');
    });
  });
});
