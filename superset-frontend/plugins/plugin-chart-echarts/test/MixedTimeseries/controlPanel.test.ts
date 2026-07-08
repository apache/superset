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
import { GenericDataType } from '@apache-superset/core/common';
import { ControlPanelState, isCustomControlItem } from '@superset-ui/chart-controls';
import controlPanel from '../../src/MixedTimeseries/controlPanel';
import { EchartsTimeseriesSeriesType } from '../../src/Timeseries/types';

const config = controlPanel;

const getControl = (controlName: string) => {
  for (const section of config.controlPanelSections) {
    if (section && section.controlSetRows) {
      for (const row of section.controlSetRows) {
        for (const control of row) {
          if (
            typeof control === 'object' &&
            control !== null &&
            'name' in control &&
            control.name === controlName
          ) {
            return control;
          }
        }
      }
    }
  }

  return null;
};

const numericXAxisState = {
  controls: {
    x_axis: { value: 'year' },
    datasource: {
      datasource: {
        columns: [{ column_name: 'year', type_generic: GenericDataType.Numeric }],
      },
    },
    seriesType: { value: EchartsTimeseriesSeriesType.Line },
    seriesTypeB: { value: EchartsTimeseriesSeriesType.Line },
  },
} as unknown as ControlPanelState;

const nonNumericXAxisState = {
  controls: {
    x_axis: { value: 'year' },
    datasource: {
      datasource: {
        columns: [{ column_name: 'year', type_generic: GenericDataType.String }],
      },
    },
    seriesType: { value: EchartsTimeseriesSeriesType.Bar },
    seriesTypeB: { value: EchartsTimeseriesSeriesType.Bar },
  },
} as unknown as ControlPanelState;

test('xAxisForceCategorical is exposed in shared query fields', () => {
  expect(getControl('xAxisForceCategorical')).not.toBeNull();
});

test('xAxisForceCategorical defaults to true when any query uses bar series', () => {
  const control = getControl('xAxisForceCategorical');
  const initialValue = isCustomControlItem(control)
    ? control.config.initialValue
    : undefined;

  expect(
    initialValue?.(undefined, {
      ...numericXAxisState,
      controls: {
        ...numericXAxisState.controls,
        seriesType: { value: EchartsTimeseriesSeriesType.Bar },
        seriesTypeB: { value: EchartsTimeseriesSeriesType.Line },
      },
    } as unknown as ControlPanelState),
  ).toBe(true);

  expect(
    initialValue?.(undefined, {
      ...numericXAxisState,
      controls: {
        ...numericXAxisState.controls,
        seriesType: { value: EchartsTimeseriesSeriesType.Line },
        seriesTypeB: { value: EchartsTimeseriesSeriesType.Bar },
      },
    } as unknown as ControlPanelState),
  ).toBe(true);
});

test('xAxisForceCategorical defaults to false for line-only mixed charts', () => {
  const control = getControl('xAxisForceCategorical');
  const initialValue = isCustomControlItem(control)
    ? control.config.initialValue
    : undefined;

  expect(initialValue?.(undefined, numericXAxisState)).toBe(false);
});

test('xAxisForceCategorical preserves explicit user value', () => {
  const control = getControl('xAxisForceCategorical');
  const initialValue = isCustomControlItem(control)
    ? control.config.initialValue
    : undefined;

  expect(
    initialValue?.(
      { value: false },
      {
        ...numericXAxisState,
        controls: {
          ...numericXAxisState.controls,
          seriesType: { value: EchartsTimeseriesSeriesType.Bar },
        },
      } as unknown as ControlPanelState,
    ),
  ).toBe(false);
});

test('xAxisForceCategorical uses control value when x-axis is not numeric', () => {
  const control = getControl('xAxisForceCategorical');
  const initialValue = isCustomControlItem(control)
    ? control.config.initialValue
    : undefined;

  // Even if the series are "bar", non-numeric x-axis must not be forced
  // categorical based on x_axis_sort (mixedXAxisForceCategoricalControl
  // short-circuits to control.value).
  expect(initialValue?.({ value: false }, nonNumericXAxisState)).toBe(false);
});

test('xAxisForceCategorical returns true for numeric x-axis when x_axis_sort exists', () => {
  const control = getControl('xAxisForceCategorical');
  const initialValue = isCustomControlItem(control)
    ? control.config.initialValue
    : undefined;

  // line-only state would normally return false, but mixedXAxisForceCategoricalControl
  // forces true when form_data.x_axis_sort is defined.
  expect(
    initialValue?.(
      undefined,
      {
        ...numericXAxisState,
        form_data: { x_axis_sort: 'year' },
      } as unknown as ControlPanelState,
    ),
  ).toBe(true);
});
