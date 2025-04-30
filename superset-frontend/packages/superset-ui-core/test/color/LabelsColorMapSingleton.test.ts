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

import {
  CategoricalColorNamespace,
  CategoricalScheme,
  FeatureFlag,
  getCategoricalSchemeRegistry,
  getLabelsColorMap,
  LabelsColorMapSource,
  LabelsColorMap,
} from '@superset-ui/core';

const actual = jest.requireActual('../../src/color/utils');
const getAnalogousColorsSpy = jest
  .spyOn(actual, 'getAnalogousColors')
  .mockImplementation(() => ['red', 'green', 'blue']);

describe('LabelsColorMap', () => {
  beforeAll(() => {
    getCategoricalSchemeRegistry()
      .registerValue(
        'testColors',
        new CategoricalScheme({
          id: 'testColors',
          colors: ['red', 'green', 'blue'],
        }),
      )
      .registerValue(
        'testColors2',
        new CategoricalScheme({
          id: 'testColors2',
          colors: ['yellow', 'green', 'blue'],
        }),
      );
  });

  beforeEach(() => {
    getLabelsColorMap().source = LabelsColorMapSource.Dashboard;
    getLabelsColorMap().reset();
  });

  it('has default value out-of-the-box', () => {
    expect(getLabelsColorMap()).toBeInstanceOf(LabelsColorMap);
  });

  describe('.addSlice(value, color, sliceId)', () => {
    it('should add to sliceLabelColorMap when first adding label', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.addSlice('a', 'red', 1, 'preset');
      expect(labelsColorMap.chartsLabelsMap.has(1)).toEqual(true);
      const chartConfig = labelsColorMap.chartsLabelsMap.get(1);
      expect(chartConfig?.labels?.includes('a')).toEqual(true);
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).toEqual({ a: 'red' });
    });

    it('should add to sliceLabelColorMap when slice exist', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.addSlice('b', 'blue', 1);
      const chartConfig = labelsColorMap.chartsLabelsMap.get(1);
      expect(chartConfig?.labels?.includes('b')).toEqual(true);
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).toEqual({ a: 'red', b: 'blue' });
    });

    it('should use last color if adding label repeatedly', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.addSlice('b', 'blue', 1);
      labelsColorMap.addSlice('b', 'green', 1);
      const chartConfig = labelsColorMap.chartsLabelsMap.get(1);
      expect(chartConfig?.labels?.includes('b')).toEqual(true);
      expect(chartConfig?.labels?.length).toEqual(1);
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).toEqual({ b: 'green' });
    });

    it('should set a new color only when source is dashboard', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.source = LabelsColorMapSource.Explore;
      labelsColorMap.addSlice('a', 'red', 1);
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).toEqual({});

      labelsColorMap.source = LabelsColorMapSource.Dashboard;
      labelsColorMap.addSlice('a', 'red', 1);
      const colorMap2 = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap2)).toEqual({ a: 'red' });
    });
  });

  describe('.remove(sliceId)', () => {
    it('should remove sliceId', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.removeSlice(1);
      expect(labelsColorMap.chartsLabelsMap.has(1)).toEqual(false);
    });

    it('should update colorMap', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.addSlice('b', 'blue', 2);
      labelsColorMap.removeSlice(1);
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).toEqual({ b: 'blue' });
    });

    it('should do nothing when source is not dashboard', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.source = LabelsColorMapSource.Explore;
      labelsColorMap.removeSlice(1);
      expect(labelsColorMap.chartsLabelsMap.has(1)).toEqual(true);
    });
  });

  describe('.updateColorMap(namespace, scheme, merge)', () => {
    let categoricalNamespace: any;
    let mockedNamespace: any;
    let labelsColorMap: any;

    beforeEach(() => {
      labelsColorMap = getLabelsColorMap();
      categoricalNamespace = CategoricalColorNamespace.getNamespace(undefined);
      mockedNamespace = {
        getScale: jest.fn().mockReturnValue({
          getColor: jest.fn(() => 'mockColor'),
        }),
      };
    });

    it('should clear color map when not merge', () => {
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.updateColorMap(mockedNamespace, 'testColors2', false);
      expect(labelsColorMap.colorMap).toEqual(new Map([['a', 'mockColor']]));
    });

    it('should not clear color map when merge', () => {
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.updateColorMap(mockedNamespace, 'testColors2', true);
      expect(labelsColorMap.colorMap).not.toEqual(new Map());
    });

    it('should use provided color scheme', () => {
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.updateColorMap(mockedNamespace, 'testColors2');
      expect(mockedNamespace.getScale).toHaveBeenCalledWith('testColors2');
    });

    it('should fallback to undefined if no color scheme is provided', () => {
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.addSlice('b', 'blue', 2);
      labelsColorMap.updateColorMap(mockedNamespace);
      expect(mockedNamespace.getScale).toHaveBeenCalledWith(undefined);
    });

    it('should update color map', () => {
      // override color with forcedItems
      categoricalNamespace.setColor('b', 'green');
      // testColors2: 'yellow', 'green', 'blue'
      // first-time label, gets color, yellow
      labelsColorMap.addSlice('a', 'red', 1);
      // overridden, gets green
      labelsColorMap.addSlice('b', 'pink', 1);
      // overridden, gets green
      labelsColorMap.addSlice('b', 'green', 2);
      // first-time slice label, gets color, yellow
      labelsColorMap.addSlice('c', 'blue', 2);
      labelsColorMap.updateColorMap(categoricalNamespace, 'testColors2');
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).toEqual({
        a: 'yellow',
        b: 'green',
        c: 'yellow',
      });
    });

    it('should update only new labels in the color map when merge', () => {
      labelsColorMap.colorMap = new Map();

      labelsColorMap.addSlice('a', 'yellow', 1);
      labelsColorMap.addSlice('b', 'green', 1);
      labelsColorMap.addSlice('c', 'purple', 1);

      labelsColorMap.updateColorMap(categoricalNamespace, 'testColors2', true);

      const mergedColorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(mergedColorMap)).toEqual({
        a: 'yellow',
        b: 'green',
        c: 'purple',
      });
    });

    it('should use recycle colors', () => {
      window.featureFlags = {
        [FeatureFlag.UseAnalogousColors]: false,
      };
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.addSlice('b', 'blue', 2);
      labelsColorMap.addSlice('c', 'green', 3);
      labelsColorMap.addSlice('d', 'red', 4);
      labelsColorMap.updateColorMap(categoricalNamespace, 'testColors');
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).not.toEqual({});
      expect(getAnalogousColorsSpy).not.toHaveBeenCalled();
    });

    it('should use analogous colors', () => {
      window.featureFlags = {
        [FeatureFlag.UseAnalogousColors]: true,
      };

      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.addSlice('b', 'blue', 1);
      labelsColorMap.addSlice('c', 'green', 1);
      labelsColorMap.addSlice('d', 'red', 1);
      labelsColorMap.updateColorMap(categoricalNamespace, 'testColors');
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).not.toEqual({});
      expect(getAnalogousColorsSpy).toHaveBeenCalled();
    });
  });

  describe('.getColorMap()', () => {
    it('should get color map', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.addSlice('b', 'blue', 2);
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).toEqual({ a: 'red', b: 'blue' });
    });
  });

  describe('.reset()', () => {
    it('should reset color map', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.addSlice('a', 'red', 1);
      labelsColorMap.addSlice('b', 'blue', 2);
      labelsColorMap.clear();
      const colorMap = labelsColorMap.getColorMap();
      expect(Object.fromEntries(colorMap)).toEqual({});
    });
  });

  describe('setOwnColorScheme(sliceId, ownScheme)', () => {
    it('should update the scheme in the config', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.source = LabelsColorMapSource.Explore;
      const sliceId = 1;
      const initialConfig = { labels: ['initial config'] };

      labelsColorMap.chartsLabelsMap = new Map();
      labelsColorMap.chartsLabelsMap.set(sliceId, initialConfig);

      labelsColorMap.setOwnColorScheme(sliceId, 'newScheme');

      expect(labelsColorMap.chartsLabelsMap.get(sliceId)).toEqual({
        ...initialConfig,
        ownScheme: 'newScheme',
      });
    });
    it('should update ownScheme when source is not Explore', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.source = LabelsColorMapSource.Dashboard;
      const sliceId = 1;
      const initialConfig = { labels: ['initial config'] };

      labelsColorMap.chartsLabelsMap = new Map();
      labelsColorMap.chartsLabelsMap.set(sliceId, initialConfig);

      labelsColorMap.setOwnColorScheme(sliceId, 'newScheme');

      expect(labelsColorMap.chartsLabelsMap.get(sliceId)).toEqual({
        ...initialConfig,
        ownScheme: 'newScheme',
      });
    });
    it('should do nothing when chart config does not exist', () => {
      const labelsColorMap = getLabelsColorMap();
      labelsColorMap.source = LabelsColorMapSource.Explore;
      const sliceId = 1;

      labelsColorMap.setOwnColorScheme(sliceId, 'newScheme');
      expect(labelsColorMap.chartsLabelsMap.get(sliceId)).toEqual(undefined);
    });
  });
});
