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
  getLabelsColorMap,
  LabelsColorMapSource,
} from '@superset-ui/core';

describe('CategoricalColorScale', () => {
  beforeEach(() => {
    window.featureFlags = {};
  });

  test('exists', () => {
    expect(CategoricalColorScale !== undefined).toBe(true);
  });

  describe('new CategoricalColorScale(colors, forcedColors)', () => {
    test('can create new scale when forcedColors is not given', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale).toBeInstanceOf(CategoricalColorScale);
    });
    test('can create new scale when forcedColors is given', () => {
      const forcedColors = {};
      const scale = new CategoricalColorScale(
        ['blue', 'red', 'green'],
        forcedColors,
      );
      expect(scale).toBeInstanceOf(CategoricalColorScale);
      expect(scale.forcedColors).toBe(forcedColors);
    });
    test('can refer to colors based on their index', () => {
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
      [currentLabel: string, currentColor: string]
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

    test('uses labelsColorMapInstance color map when source is Dashboard, otherwise uses chartLabelsColorMap', () => {
      const sliceId = 123;
      const colorScheme = 'preset';

      // Mock chartLabelsColorMap and labelsColorMapInstance's getColorMap
      const chartColorMap = new Map([['testValueChart', 'chartColor']]);
      const dashboardColorMap = new Map([['testValueDash', 'dashboardColor']]);
      scale.chartLabelsColorMap = chartColorMap;
      jest
        .spyOn(scale.labelsColorMapInstance, 'getColorMap')
        .mockReturnValue(dashboardColorMap);

      // Test when source is Dashboard
      scale.labelsColorMapInstance.source = LabelsColorMapSource.Dashboard;
      const colorFromDashboard = scale.getColor(
        'testValueDash',
        sliceId,
        colorScheme,
      );
      expect(colorFromDashboard).toBe('dashboardColor');

      // Test when source is not Dashboard
      scale.labelsColorMapInstance.source = LabelsColorMapSource.Explore;
      const colorFromChart = scale.getColor(
        'testValueChart',
        sliceId,
        colorScheme,
      );
      expect(colorFromChart).toBe('chartColor');
    });
    test('returns same color for same value', () => {
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
    test('returns different color for consecutive items', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const c1 = scale.getColor('pig');
      const c2 = scale.getColor('horse');
      const c3 = scale.getColor('cat');

      expect(c1).not.toBe(c2);
      expect(c2).not.toBe(c3);
      expect(c3).not.toBe(c1);
    });
    test('recycles colors when number of items exceed available colors', () => {
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
    test('get analogous colors when number of items exceed available colors', () => {
      window.featureFlags = {
        [FeatureFlag.UseAnalogousColors]: true,
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
    test('adds the color and value to chartLabelsColorMap and calls addSlice', () => {
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
    test('conditionally calls getNextAvailableColor', () => {
      window.featureFlags = {
        [FeatureFlag.AvoidColorsCollision]: true,
      };

      scale.getColor('testValue1');
      scale.getColor('testValue2');
      scale.getColor('testValue1');
      scale.getColor('testValue3');
      scale.getColor('testValue4');

      expect(getNextAvailableColorSpy).toHaveBeenCalledWith(
        'testValue4',
        'blue',
      );

      getNextAvailableColorSpy.mockClear();

      window.featureFlags = {
        [FeatureFlag.AvoidColorsCollision]: false,
      };

      scale.getColor('testValue3');

      expect(getNextAvailableColorSpy).not.toHaveBeenCalled();
    });
    test('reassigns non-forced labels when a dashboard-synced label would duplicate their color', () => {
      window.featureFlags = {
        [FeatureFlag.AvoidColorsCollision]: true,
      };

      const dashScale = new CategoricalColorScale(['red', 'blue', 'green']);
      const sliceId = 501;
      const colorScheme = 'preset';

      dashScale.labelsColorMapInstance.source = LabelsColorMapSource.Dashboard;
      jest
        .spyOn(dashScale.labelsColorMapInstance, 'getColorMap')
        .mockReturnValue(new Map([['Trains', 'red']]));

      // Ordinal assigns first range color (red) before the synced "Trains" label is applied.
      dashScale.getColor('Classic Cars', sliceId, colorScheme);
      dashScale.getColor('Trains', sliceId, colorScheme);

      expect(dashScale.chartLabelsColorMap.get('Trains')).toBe('red');
      expect(dashScale.chartLabelsColorMap.get('Classic Cars')).not.toBe('red');
      expect(dashScale.chartLabelsColorMap.get('Classic Cars')).toBeDefined();
    });
  });

  describe('.setColor(value, forcedColor)', () => {
    test('overrides default color', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.setColor('pig', 'pink');
      expect(scale.getColor('pig')).toBe('pink');
    });
    test('does override forcedColors', () => {
      const scale1 = new CategoricalColorScale(['blue', 'red', 'green']);
      scale1.setColor('pig', 'black');

      const scale2 = new CategoricalColorScale(['blue', 'red', 'green']);
      scale2.setColor('pig', 'pink');
      expect(scale2.getColor('pig')).toBe('pink');
      expect(scale1.getColor('pig')).toBe('black');
    });
    test('returns the scale', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const output = scale.setColor('pig', 'pink');
      expect(scale).toBe(output);
    });
  });
  describe('.getColorMap()', () => {
    test('returns correct mapping using least used color', () => {
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
    test('returns a copy', () => {
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
    test('when called without argument, returns domain', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('pig');
      expect(scale.domain()).toEqual(['pig']);
    });
    test('when called with argument, sets domain', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.domain(['dog', 'pig', 'cat']);
      expect(scale('pig')).toEqual('red');
    });
  });
  describe('.range()', () => {
    test('when called without argument, returns range', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale.range()).toEqual(['blue', 'red', 'green']);
    });
    test('when called with argument, sets range', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.range(['pink', 'gray', 'yellow']);
      expect(scale.range()).toEqual(['pink', 'gray', 'yellow']);
    });
  });
  describe('.unknown()', () => {
    test('when called without argument, returns output for unknown value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.unknown('#666');
      expect(scale.unknown()).toEqual('#666');
    });
    test('when called with argument, sets output for unknown value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.unknown('#222');
      expect(scale.unknown()).toEqual('#222');
    });
  });

  describe('a CategoricalColorScale instance is also a color function itself', () => {
    test('scale(value) returns same color for same value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale.getColor('pig')).toBe('blue');
      expect(scale('pig')).toBe('blue');
      expect(scale.getColor('cat')).toBe('red');
      expect(scale('cat')).toBe('red');
    });
  });

  describe('.getNextAvailableColor(currentLabel, currentColor)', () => {
    test('returns the current color if it is the least used or equally used among colors', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('cat');
      scale.getColor('dog');

      // Since 'green' hasn't been used, it's considered the least used.
      expect(scale.getNextAvailableColor('fish', 'blue')).toBe('green');
    });

    test('returns the least used color among all', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('cat'); // blue
      scale.getColor('dog'); // red
      scale.getColor('fish'); // green
      scale.getColor('puppy'); // blue
      scale.getColor('teddy'); // red
      // All colors used, so the function should return least used
      expect(scale.getNextAvailableColor('darling', 'red')).toBe('green');
    });

    test('returns the least used color accurately even when some colors are used more frequently', () => {
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
      expect(scale.getNextAvailableColor('pony', 'blue')).toBe('yellow');
    });
    test('does not return adjacent colors if a non-adjacent color is equally used', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.chartLabelsColorMap.set('label1', 'red'); // Adjacent
      scale.chartLabelsColorMap.set('label2', 'blue'); // currentLabel
      scale.chartLabelsColorMap.set('label3', 'green'); // Adjacent

      // Green and blue are equally used, but green is adjacent and penalized.
      expect(scale.getNextAvailableColor('label2', 'blue')).toBe('blue');
    });
    test('prioritizes a color that has never been used, even if there are adjacent colors', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('cat'); // blue
      scale.getColor('dog'); // red

      scale.chartLabelsColorMap.set('label1', 'red');
      scale.chartLabelsColorMap.set('label2', 'blue'); // currentLabel

      // Green has never been used, so it is prioritized.
      expect(scale.getNextAvailableColor('label2', 'blue')).toBe('green');
    });
    test('returns the least used or unused color when there are no adjacent labels', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.getColor('cat'); // blue
      scale.getColor('dog'); // red

      // No adjacent labels are defined in chartLabelsColorMap.
      expect(scale.getNextAvailableColor('label2', 'green')).toBe('green');
    });
    test('handles colors that have never been used (fallback to usage count 0)', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);

      // Do not use "green" at all
      scale.getColor('cat'); // blue
      scale.getColor('dog'); // red

      // "green" has never been used, so usageCount for "green" should fallback to 0
      expect(scale.getNextAvailableColor('label2', 'red')).toBe('green');
    });
    test('handles a color with an explicit usage count of 0', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);

      // Mock or override getColorUsageCount to return 0 for "blue"
      jest.spyOn(scale, 'getColorUsageCount').mockImplementation(color => {
        if (color === 'blue') return 0; // Explicitly return 0 for "blue"
        return 1; // Return 1 for other colors
      });

      // "blue" should still be a valid option with a usage count of 0
      expect(scale.getNextAvailableColor('label1', 'red')).toBe('blue');
    });
  });

  describe('.isColorUsed(color)', () => {
    test('returns true if the color is already used, false otherwise', () => {
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
    test('accurately counts the occurrences of a specific color', () => {
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

  describe('dashboard color collision — shared dimension across charts (SC bug)', () => {
    /**
     * Reproduces: Dashboard color collision — shared dimension names cause
     * duplicate colors across charts.
     *
     * Steps from the bug report:
     *   Chart A: only "Trains" → palette assigns red (slot 0)
     *            → dashboard singleton locks Trains = red
     *   Chart B: "Classic Cars" + "Trains"
     *            → ordinal assigns Classic Cars = red (slot 0, same as Trains)
     *            → dashboard sync forces Trains = red
     *            → BUG: both Classic Cars and Trains render as red
     *
     * The fix (AvoidColorsCollision flag) detects the collision when Trains
     * locks to red and reassigns Classic Cars to a different color.
     */

    let labelsColorMap: ReturnType<typeof getLabelsColorMap>;

    beforeEach(() => {
      window.featureFlags = {
        [FeatureFlag.AvoidColorsCollision]: true,
      };
      // Reset the shared dashboard singleton before each scenario
      const sentinel = new CategoricalColorScale(['red', 'blue', 'green']);
      labelsColorMap = sentinel.labelsColorMapInstance;
      labelsColorMap.reset();
      labelsColorMap.source = LabelsColorMapSource.Dashboard;
    });

    afterEach(() => {
      jest.restoreAllMocks();
      labelsColorMap.reset();
    });

    test('reproduces the bug without the fix: Classic Cars and Trains would both be red', () => {
      // Disable the fix so the raw collision is observable
      window.featureFlags = {
        [FeatureFlag.AvoidColorsCollision]: false,
      };

      const PALETTE = ['red', 'blue', 'green'];

      // Chart A: Trains → red (ordinal slot 0), stored in dashboard singleton
      const chartAScale = new CategoricalColorScale(PALETTE);
      chartAScale.getColor('Trains', 101, 'testScheme');
      expect(labelsColorMap.getColorMap().get('Trains')).toBe('red');

      // Chart B: Classic Cars renders first → ordinal assigns red (slot 0)
      // Then Trains renders → dashboard map returns red (locked from Chart A)
      const chartBScale = new CategoricalColorScale(PALETTE);
      chartBScale.getColor('Classic Cars', 102, 'testScheme');
      chartBScale.getColor('Trains', 102, 'testScheme');

      const classicCarsColor =
        chartBScale.chartLabelsColorMap.get('Classic Cars');
      const trainsColor = chartBScale.chartLabelsColorMap.get('Trains');

      // Without the fix both are red — this is the bug
      expect(trainsColor).toBe('red');
      expect(classicCarsColor).toBe('red'); // collision!
    });

    test('fix: Classic Cars is reassigned when Trains locks red from the dashboard', () => {
      const PALETTE = ['red', 'blue', 'green'];

      // Chart A: Trains → red (ordinal slot 0), stored in dashboard singleton
      const chartAScale = new CategoricalColorScale(PALETTE);
      chartAScale.getColor('Trains', 101, 'testScheme');
      expect(labelsColorMap.getColorMap().get('Trains')).toBe('red');

      // Chart B: Classic Cars renders first → ordinal assigns red (slot 0)
      // Then Trains renders → dashboard map returns red (locked from Chart A)
      // Fix: collision detected, Classic Cars reassigned away from red
      const chartBScale = new CategoricalColorScale(PALETTE);
      chartBScale.getColor('Classic Cars', 102, 'testScheme');
      chartBScale.getColor('Trains', 102, 'testScheme');

      const classicCarsColor =
        chartBScale.chartLabelsColorMap.get('Classic Cars');
      const trainsColor = chartBScale.chartLabelsColorMap.get('Trains');

      // Trains keeps its dashboard-locked color
      expect(trainsColor).toBe('red');
      // Classic Cars must be reassigned to something other than red
      expect(classicCarsColor).toBeDefined();
      expect(classicCarsColor).not.toBe('red');
    });

    test('fix: no series in Chart B share a color when palette has enough colors', () => {
      const PALETTE = ['red', 'blue', 'green'];

      // Chart A locks Trains = red
      const chartAScale = new CategoricalColorScale(PALETTE);
      chartAScale.getColor('Trains', 101, 'testScheme');

      // Chart B has Classic Cars + Trains
      const chartBScale = new CategoricalColorScale(PALETTE);
      chartBScale.getColor('Classic Cars', 102, 'testScheme');
      chartBScale.getColor('Trains', 102, 'testScheme');

      const colors = Array.from(chartBScale.chartLabelsColorMap.values());
      const uniqueColors = new Set(colors);

      // Both series should have distinct colors
      expect(uniqueColors.size).toBe(colors.length);
    });

    test('fix: forced colors (user-set in dashboard JSON) are never reassigned', () => {
      const PALETTE = ['red', 'blue', 'green'];
      // Simulate the user having set "Classic Cars" = red in dashboard metadata
      const forcedColors = { 'Classic Cars': 'red' };

      // Chart A locks Trains = red
      const chartAScale = new CategoricalColorScale(PALETTE);
      chartAScale.getColor('Trains', 101, 'testScheme');

      // Chart B: Classic Cars is forced to red, Trains is dashboard-locked to red
      const chartBScale = new CategoricalColorScale(PALETTE, forcedColors);
      chartBScale.getColor('Classic Cars', 102, 'testScheme');
      chartBScale.getColor('Trains', 102, 'testScheme');

      // Classic Cars must keep its forced color even if it collides
      expect(chartBScale.chartLabelsColorMap.get('Classic Cars')).toBe('red');
    });
  });

  describe("is compatible with D3's ScaleOrdinal", () => {
    test('passes type check', () => {
      const scale: ScaleOrdinal<{ toString(): string }, string> =
        new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale('pig')).toBe('blue');
    });
  });
});
