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

import { ZoomConfigs } from './types';
import {
  computeConfigValues,
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  toExpConfig,
  toFixedConfig,
  toLinearConfig,
  zoomConfigsToData,
} from './zoomUtil';

const zoomConfigValues = {
  ...Array.from({ length: MAX_ZOOM_LEVEL - MIN_ZOOM_LEVEL + 1 }, () => ({
    width: 100,
    height: 100,
  })),
};

describe('zoomUtil', () => {
  describe('computeConfigValues', () => {
    it('computes fixed values', () => {
      const height = 100;
      const width = 100;

      const zoomConfigs: ZoomConfigs = {
        type: 'FIXED',
        values: {},
        configs: {
          zoom: 2,
          width,
          height,
        },
      };
      const result = computeConfigValues(zoomConfigs);
      expect(Object.keys(result).length).toEqual(
        Object.keys(zoomConfigValues).length,
      );
      expect(result[4]).toEqual({
        width,
        height,
      });
    });

    it('computes linear values', () => {
      const height = 100;
      const width = 100;

      const zoomConfigs: ZoomConfigs = {
        type: 'LINEAR',
        values: {},
        configs: {
          zoom: 2,
          width,
          height,
          slope: 2,
        },
      };
      const result = computeConfigValues(zoomConfigs);

      expect(Object.keys(result).length).toEqual(
        Object.keys(zoomConfigValues).length,
      );
      expect(result[4]).toEqual({
        width: 104,
        height: 104,
      });
    });

    it('computes exponential values', () => {
      const height = 100;
      const width = 100;

      const zoomConfigs: ZoomConfigs = {
        type: 'EXP',
        values: {},
        configs: {
          zoom: 2,
          width,
          height,
          exponent: 1.6,
        },
      };
      const result = computeConfigValues(zoomConfigs);

      expect(Object.keys(result).length).toEqual(
        Object.keys(zoomConfigValues).length,
      );

      expect(result[4]).toEqual({
        width: 119,
        height: 119,
      });
    });
  });

  describe('zoomConfigsToData', () => {
    it('returns correct output', () => {
      const result = zoomConfigsToData(zoomConfigValues);

      expect(result.length).toEqual(Object.keys(zoomConfigValues).length);
      expect(result[12]).toEqual([100, 100, 12]);
    });
  });

  describe('toFixedConfig', () => {
    const configs: ZoomConfigs['configs'] = {
      width: 100,
      height: 100,
      zoom: 5,
    };
    const result = toFixedConfig(configs);

    it('has correct type', () => {
      expect(result.type).toEqual('FIXED');
    });

    it('returns correct result', () => {
      expect(result.values[4]).toEqual({
        width: 100,
        height: 100,
      });

      expect(result.values[6]).toEqual({
        width: 100,
        height: 100,
      });
    });
  });

  describe('toLinearConfig', () => {
    const configs: ZoomConfigs['configs'] = {
      width: 100,
      height: 100,
      zoom: 5,
      slope: 2,
    };
    const result = toLinearConfig(configs);

    it('has correct type', () => {
      expect(result.type).toEqual('LINEAR');
    });

    it('returns correct result', () => {
      expect(result.values[4]).toEqual({
        width: 98,
        height: 98,
      });

      expect(result.values[6]).toEqual({
        width: 102,
        height: 102,
      });
    });
  });

  describe('toExpConfig', () => {
    const configs: ZoomConfigs['configs'] = {
      width: 100,
      height: 100,
      zoom: 5,
      exponent: 1.5,
    };
    // @ts-ignore
    const result = toExpConfig(configs);
    it('has correct type', () => {
      expect(result.type).toEqual('EXP');
    });
    it('returns correct result', () => {
      expect(result.values[4]).toEqual({
        width: 93,
        height: 93,
      });

      expect(result.values[6]).toEqual({
        width: 107,
        height: 107,
      });
    });
  });
});
