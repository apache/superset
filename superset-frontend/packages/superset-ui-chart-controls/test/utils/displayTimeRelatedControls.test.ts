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
import { VizType } from '@superset-ui/core';
import { displayTimeRelatedControls } from '../../src';

const mockData = {
  actions: {
    setDatasource: jest.fn(),
  },
  controls: {
    x_axis: {
      type: 'SelectControl' as const,
      value: 'not_temporal',
      options: [
        { column_name: 'not_temporal', is_dttm: false },
        { column_name: 'ds', is_dttm: true },
      ],
    },
  },
  exportState: {},
  form_data: {
    datasource: '22__table',
    viz_type: VizType.Table,
  },
};

test('returns true when no x-axis exists', () => {
  expect(
    displayTimeRelatedControls({
      ...mockData,
      controls: {
        control_options: {
          type: 'SelectControl',
          value: 'not_temporal',
          options: [],
        },
      },
    }),
  ).toBeTruthy();
});

test('returns false when x-axis value is not temporal', () => {
  expect(displayTimeRelatedControls(mockData)).toBeFalsy();
});
test('returns true when x-axis value is temporal', () => {
  expect(
    displayTimeRelatedControls({
      ...mockData,
      controls: {
        x_axis: {
          ...mockData.controls.x_axis,
          value: 'ds',
        },
      },
    }),
  ).toBeTruthy();
});

test('returns false when x-axis value without options', () => {
  expect(
    displayTimeRelatedControls({
      ...mockData,
      controls: {
        x_axis: {
          type: 'SelectControl' as const,
          value: 'not_temporal',
        },
      },
    }),
  ).toBeFalsy();
});

test('returns true when x-axis is ad-hoc column', () => {
  expect(
    displayTimeRelatedControls({
      ...mockData,
      controls: {
        x_axis: {
          ...mockData.controls.x_axis,
          value: {
            sqlExpression: 'ds',
            label: 'ds',
            expressionType: 'SQL',
          },
        },
      },
    }),
  ).toBeTruthy();
});

test('returns false when the x-axis is neither an ad-hoc column nor a physical column', () => {
  expect(
    displayTimeRelatedControls({
      ...mockData,
      controls: {
        x_axis: {
          ...mockData.controls.x_axis,
          value: {},
        },
      },
    }),
  ).toBeFalsy();
});
