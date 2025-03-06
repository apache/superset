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

import { ChartConfig } from '../../src/types';
import { isChartConfigEqual, simplifyConfig } from '../../src/util/chartUtil';

describe('chartUtil', () => {
  const configA: ChartConfig = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [],
        },
        properties: {
          refs: 'foo',
        },
      },
    ],
  };

  const configB: ChartConfig = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [],
        },
        properties: {
          refs: 'foo',
          foo: 'bar',
        },
      },
    ],
  };

  describe('simplifyConfig', () => {
    it('removes the refs property from a feature', () => {
      const simplifiedConfig = simplifyConfig(configA);
      const propKeys = Object.keys(simplifiedConfig.features[0].properties);

      expect(propKeys).toHaveLength(0);
    });
  });

  describe('isChartConfigEqual', () => {
    it('returns true, if configurations are equal', () => {
      const isEqual = isChartConfigEqual(configA, structuredClone(configA));
      expect(isEqual).toBe(true);
    });

    it('returns false if configurations are not equal', () => {
      const isEqual = isChartConfigEqual(configA, configB);
      expect(isEqual).toBe(false);
    });
  });
});
