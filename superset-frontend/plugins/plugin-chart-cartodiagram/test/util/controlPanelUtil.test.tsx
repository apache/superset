/**
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
  ControlPanelConfig,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import {
  getLayerConfig,
  selectedChartMutator,
} from '../../src/util/controlPanelUtil';

describe('controlPanelUtil', () => {
  describe('getLayerConfig', () => {
    it('returns the correct layer config', () => {
      const layerConfigs: CustomControlItem = {
        name: 'layer_configs',
        config: {
          type: 'dummy',
          renderTrigger: true,
          label: 'Layers',
          default: [
            {
              type: 'XYZ',
              url: 'http://example.com/',
              title: 'dummy title',
              attribution: 'dummy attribution',
            },
          ],
          description: 'The configuration for the map layers',
        },
      };
      const controlPanel: ControlPanelConfig = {
        controlPanelSections: [
          {
            label: 'Configuration',
            expanded: true,
            controlSetRows: [],
          },
          {
            label: 'Map Options',
            expanded: true,
            controlSetRows: [
              [
                {
                  name: 'map_view',
                  config: {
                    type: 'dummy',
                  },
                },
              ],
              [layerConfigs],
            ],
          },
          {
            label: 'Chart Options',
            expanded: true,
            controlSetRows: [],
          },
        ],
      };
      const extractedLayerConfigs = getLayerConfig(controlPanel);

      expect(extractedLayerConfigs).toEqual(layerConfigs);
    });
  });

  describe('selectedChartMutator', () => {
    it('returns empty array for empty inputs', () => {
      const response = {};
      const value = undefined;
      const result = selectedChartMutator(response, value);
      expect(result).toEqual([]);
    });

    it('returns parsed value if response is empty', () => {
      const response = {};

      const sliceName = 'foobar';
      const value = JSON.stringify({
        id: 278,
        params: '',
        slice_name: sliceName,
        viz_type: 'pie',
      });

      const result = selectedChartMutator(response, value);

      expect(result[0].label).toEqual(sliceName);
    });

    it('returns response options if no value is chosen', () => {
      const sliceName1 = 'foo';
      const sliceName2 = 'bar';
      const response = {
        result: [
          {
            id: 1,
            params: '{}',
            slice_name: sliceName1,
            viz_type: 'viz1',
          },
          {
            id: 2,
            params: '{}',
            slice_name: sliceName2,
            viz_type: 'viz2',
          },
        ],
      };
      const value = undefined;

      const result = selectedChartMutator(response, value);
      expect(result[0].label).toEqual(sliceName1);
      expect(result[1].label).toEqual(sliceName2);
    });

    it('returns correct result if id of chosen config does not exist in response', () => {
      const response = {
        result: [
          {
            id: 1,
            params: '{}',
            slice_name: 'foo',
            viz_type: 'viz1',
          },
          {
            id: 2,
            params: '{}',
            slice_name: 'bar',
            viz_type: 'viz2',
          },
        ],
      };

      const value = JSON.stringify({
        id: 3,
        params: '{}',
        slice_name: 'my-slice',
        viz_type: 'pie',
      });

      const result = selectedChartMutator(response, value);

      // collect all ids in a set to prevent double entries
      const ids = new Set();
      result.forEach((item: any) => {
        const config = JSON.parse(item.value);
        const { id } = config;
        ids.add(id);
      });

      const threeDifferentIds = ids.size === 3;

      expect(threeDifferentIds).toEqual(true);
    });

    it('returns correct result if id of chosen config already exists', () => {
      const response = {
        result: [
          {
            id: 1,
            params: '{}',
            slice_name: 'foo',
            viz_type: 'viz1',
          },
          {
            id: 2,
            params: '{}',
            slice_name: 'bar',
            viz_type: 'viz2',
          },
        ],
      };

      const value = JSON.stringify({
        id: 1,
        params: '{}',
        slice_name: 'my-slice',
        viz_type: 'pie',
      });

      const result = selectedChartMutator(response, value);

      const itemsIdWithId1 = result.filter((item: any) => {
        const config = JSON.parse(item.value);
        const { id } = config;
        return id === 1;
      });
      expect(itemsIdWithId1.length).toEqual(2);

      const labelsEqual = itemsIdWithId1[0].label === itemsIdWithId1[1].label;
      expect(labelsEqual).toEqual(false);
    });
  });
});
