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
import { ChartProps } from '@superset-ui/core';
import transformProps from './transformProps';
import { DeckglLayerVisibilityFormData } from './types';

test('transforms props correctly with all required fields', () => {
  const setDataMaskMock = jest.fn();
  const formData: DeckglLayerVisibilityFormData = {
    viz_type: 'deckgl_layer_visibility',
    defaultToAllLayersVisible: true,
    datasource: '1__table',
  };

  const chartProps = {
    formData,
    height: 400,
    width: 600,
    filterState: { value: [1, 2] },
    hooks: { setDataMask: setDataMaskMock },
    ownState: { availableLayers: [] },
  } as unknown as ChartProps;

  const result = transformProps(chartProps);

  expect(result).toEqual({
    formData,
    height: 400,
    width: 600,
    filterState: { value: [1, 2] },
    setDataMask: setDataMaskMock,
    ownState: { availableLayers: [] },
  });
});

test('transforms props with empty filter state', () => {
  const setDataMaskMock = jest.fn();
  const formData: DeckglLayerVisibilityFormData = {
    viz_type: 'deckgl_layer_visibility',
    defaultToAllLayersVisible: false,
    datasource: '1__table',
  };

  const chartProps = {
    formData,
    height: 300,
    width: 500,
    filterState: {},
    hooks: { setDataMask: setDataMaskMock },
    ownState: undefined,
  } as unknown as ChartProps;

  const result = transformProps(chartProps);

  expect(result).toEqual({
    formData,
    height: 300,
    width: 500,
    filterState: {},
    setDataMask: setDataMaskMock,
    ownState: undefined,
  });
});

test('preserves setDataMask function reference', () => {
  const setDataMaskMock = jest.fn();
  const formData: DeckglLayerVisibilityFormData = {
    viz_type: 'deckgl_layer_visibility',
    defaultToAllLayersVisible: true,
    datasource: '1__table',
  };

  const chartProps = {
    formData,
    height: 200,
    width: 400,
    filterState: {},
    hooks: { setDataMask: setDataMaskMock },
  } as unknown as ChartProps;

  const result = transformProps(chartProps);

  expect(result.setDataMask).toBe(setDataMaskMock);
});
