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
import { SqlaFormData } from '@superset-ui/core';
import { ControlPanelsContainerProps } from '@superset-ui/chart-controls/types';

const mockPopAllMetrics = jest.fn();

jest.mock('@superset-ui/chart-controls', () => {
  const actual = jest.requireActual('@superset-ui/chart-controls');
  return {
    ...actual,
    getStandardizedControls: jest.fn(() => ({
      popAllMetrics: mockPopAllMetrics,
    })),
  };
});

// eslint-disable-next-line import/first
import controlPanel from '../../src/Candlestick/controlPanel';

type VisibilityControl = {
  name: string;
  config: { visibility: (props: ControlPanelsContainerProps) => boolean };
};

const getControl = (controlName: string) => {
  for (const section of controlPanel.controlPanelSections) {
    if (!section?.controlSetRows) {
      continue;
    }
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
  return null;
};

test('formDataOverrides consumes four metrics for open, close, high, and low', () => {
  mockPopAllMetrics.mockReturnValueOnce([
    'openMetric',
    'closeMetric',
    'highMetric',
    'lowMetric',
    'extraMetric',
  ]);

  expect(controlPanel.formDataOverrides).toBeDefined();

  const dummyFormData = { someProp: 'test' } as unknown as SqlaFormData;
  const newFormData = controlPanel.formDataOverrides!(dummyFormData);

  expect(newFormData.someProp).toBe('test');
  expect(newFormData.open).toBe('openMetric');
  expect(newFormData.close).toBe('closeMetric');
  expect(newFormData.high).toBe('highMetric');
  expect(newFormData.low).toBe('lowMetric');
  expect(mockPopAllMetrics).toHaveBeenCalledTimes(1);
});

test('formDataOverrides keeps existing OHLC fields when fewer than four metrics are available', () => {
  mockPopAllMetrics.mockReturnValueOnce(['openMetric']);

  const dummyFormData = {
    someProp: 'test',
    open: 'existingOpen',
    close: 'existingClose',
    high: 'existingHigh',
    low: 'existingLow',
  } as unknown as SqlaFormData;
  const newFormData = controlPanel.formDataOverrides!(dummyFormData);

  expect(newFormData.open).toBe('openMetric');
  expect(newFormData.close).toBe('existingClose');
  expect(newFormData.high).toBe('existingHigh');
  expect(newFormData.low).toBe('existingLow');
});

test('overrides series to a single optional dimension', () => {
  expect(controlPanel.controlOverrides?.series).toEqual(
    expect.objectContaining({
      multi: false,
    }),
  );
});

test('exposes a series style control for candlestick and OHLC', () => {
  const seriesStyleControl = getControl('series_style') as {
    name: string;
    config: {
      default: string;
      choices: [string, string][];
    };
  } | null;
  expect(seriesStyleControl).not.toBeNull();
  expect(seriesStyleControl?.config.default).toBe('candlestick');
  expect(seriesStyleControl?.config.choices).toEqual([
    ['candlestick', 'Candlestick'],
    ['ohlc', 'OHLC'],
  ]);
});

test('shows series name only when the default candlestick series is used', () => {
  const seriesNameControl = getControl(
    'candlestick_series_name',
  ) as VisibilityControl | null;
  expect(seriesNameControl).not.toBeNull();
  expect(seriesNameControl?.config.visibility).toBeDefined();

  const { visibility } = seriesNameControl!.config;

  expect(
    visibility({
      controls: {},
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);
  expect(
    visibility({
      controls: { series: { value: null } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);
  expect(
    visibility({
      controls: { series: { value: [] } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);
  expect(
    visibility({
      controls: { series: { value: 'symbol' } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
});

const withOneSeriesValue = {
  controls: { series: { value: 'symbol' } },
  chart: {
    queriesResponse: [
      {
        data: [
          { date: '2017-10-24', symbol: 'AAPL' },
          { date: '2017-10-25', symbol: 'AAPL' },
        ],
      },
    ],
  },
} as unknown as ControlPanelsContainerProps;

const withMultipleSeriesValues = {
  controls: { series: { value: 'symbol' } },
  chart: {
    queriesResponse: [
      {
        data: [
          { date: '2017-10-24', symbol: 'AAPL' },
          { date: '2017-10-24', symbol: 'GOOG' },
        ],
      },
    ],
  },
} as unknown as ControlPanelsContainerProps;

test('shows color scheme when multiple series values are present or direction coloring is off', () => {
  const colorScheme = getControl('color_scheme') as VisibilityControl | null;
  expect(colorScheme?.config.visibility).toBeDefined();

  expect(
    colorScheme!.config.visibility({
      controls: { series: { value: null } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
  expect(colorScheme!.config.visibility(withOneSeriesValue)).toBe(false);
  expect(colorScheme!.config.visibility(withMultipleSeriesValues)).toBe(true);
  expect(
    colorScheme!.config.visibility({
      controls: {
        series: { value: null },
        color_by_direction: { value: false },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);
});

test('keeps color by direction when Series has a single value and hides it for multiple values', () => {
  const colorByDirection = getControl(
    'color_by_direction',
  ) as VisibilityControl | null;
  const increaseColor = getControl(
    'increase_color',
  ) as VisibilityControl | null;
  const decreaseColor = getControl(
    'decrease_color',
  ) as VisibilityControl | null;
  expect(colorByDirection?.config.visibility).toBeDefined();
  expect(increaseColor?.config.visibility).toBeDefined();
  expect(decreaseColor?.config.visibility).toBeDefined();

  const noSeries = {
    controls: { series: { value: null } },
  } as unknown as ControlPanelsContainerProps;

  expect(colorByDirection!.config.visibility(noSeries)).toBe(true);
  expect(increaseColor!.config.visibility(noSeries)).toBe(true);
  expect(decreaseColor!.config.visibility(noSeries)).toBe(true);
  expect(colorByDirection!.config.visibility(withOneSeriesValue)).toBe(true);
  expect(increaseColor!.config.visibility(withOneSeriesValue)).toBe(true);
  expect(decreaseColor!.config.visibility(withOneSeriesValue)).toBe(true);
  expect(colorByDirection!.config.visibility(withMultipleSeriesValues)).toBe(
    false,
  );
  expect(increaseColor!.config.visibility(withMultipleSeriesValues)).toBe(
    false,
  );
  expect(decreaseColor!.config.visibility(withMultipleSeriesValues)).toBe(
    false,
  );
});

test('hides increase and decrease colors when color by direction is off', () => {
  const increaseColor = getControl(
    'increase_color',
  ) as VisibilityControl | null;
  expect(increaseColor?.config.visibility).toBeDefined();
  expect(
    increaseColor!.config.visibility({
      controls: { color_by_direction: { value: true } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);
  expect(
    increaseColor!.config.visibility({
      controls: { color_by_direction: { value: false } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
});
