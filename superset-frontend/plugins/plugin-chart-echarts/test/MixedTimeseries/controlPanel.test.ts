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
import { ControlPanelState } from '@superset-ui/chart-controls';
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

test('xAxisForceCategorical is exposed in shared query fields', () => {
  expect(getControl('xAxisForceCategorical')).not.toBeNull();
});

test('xAxisForceCategorical defaults to true when any query uses bar series', () => {
  const control = getControl('xAxisForceCategorical');
  const initialValue = control?.config?.initialValue;

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
  const initialValue = control?.config?.initialValue;

  expect(initialValue?.(undefined, numericXAxisState)).toBe(false);
});

test('xAxisForceCategorical preserves explicit user value', () => {
  const control = getControl('xAxisForceCategorical');
  const initialValue = control?.config?.initialValue;

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
