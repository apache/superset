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

test('computes fixed values', () => {
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

test('computes linear values', () => {
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

test('computes exponential values', () => {
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

test('returns correct output', () => {
  const result = zoomConfigsToData(zoomConfigValues);

  expect(result.length).toEqual(Object.keys(zoomConfigValues).length);
  expect(result[12]).toEqual([100, 100, 12]);
});

const fixedConfigs: ZoomConfigs['configs'] = {
  width: 100,
  height: 100,
  zoom: 5,
};
const fixedResult = toFixedConfig(fixedConfigs);

test('fixed config: has correct type', () => {
  expect(fixedResult.type).toEqual('FIXED');
});

test('fixed config: returns correct result', () => {
  expect(fixedResult.values[4]).toEqual({
    width: 100,
    height: 100,
  });

  expect(fixedResult.values[6]).toEqual({
    width: 100,
    height: 100,
  });
});

const linearConfigs: ZoomConfigs['configs'] = {
  width: 100,
  height: 100,
  zoom: 5,
  slope: 2,
};
const linearResult = toLinearConfig(linearConfigs);

test('linear config: has correct type', () => {
  expect(linearResult.type).toEqual('LINEAR');
});

test('linear config: returns correct result', () => {
  expect(linearResult.values[4]).toEqual({
    width: 98,
    height: 98,
  });

  expect(linearResult.values[6]).toEqual({
    width: 102,
    height: 102,
  });
});

const expConfigs: ZoomConfigs['configs'] = {
  width: 100,
  height: 100,
  zoom: 5,
  exponent: 1.5,
};
// @ts-expect-error - testing with partial config object
const expResult = toExpConfig(expConfigs);
test('exp config: has correct type', () => {
  expect(expResult.type).toEqual('EXP');
});
test('exp config: returns correct result', () => {
  expect(expResult.values[4]).toEqual({
    width: 93,
    height: 93,
  });

  expect(expResult.values[6]).toEqual({
    width: 107,
    height: 107,
  });
});
