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

import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import {
  EchartsTimeseriesChartPlugin,
  TimeseriesTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from './data';
import negativeNumData from './negativeNumData';
import confbandData from './confbandData';
import stackWithNullsData from './stackWithNulls';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTimeseriesChartPlugin()
  .configure({ key: 'echarts-timeseries' })
  .register();

getChartTransformPropsRegistry().registerValue(
  'echarts-timeseries',
  TimeseriesTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/SeriesChart',
  decorators: [withResizableChartDemo],
};

export const Timeseries = (
  {
    forecastEnabled,
    seriesType,
    logAxis,
    stack,
    showValue,
    onlyTotal,
    percentageThreshold,
    area,
    markerEnabled,
    markerSize,
    minorSplitLine,
    opacity,
    zoomable,
  }: {
    forecastEnabled: boolean;
    seriesType: string;
    logAxis: boolean;
    stack: boolean;
    showValue: boolean;
    onlyTotal: boolean;
    percentageThreshold: number;
    area: boolean;
    markerEnabled: boolean;
    markerSize: number;
    minorSplitLine: boolean;
    opacity: number;
    zoomable: boolean;
  },
  { width, height }: { width: number; height: number },
) => {
  const queryData = data
    .map(row =>
      forecastEnabled
        ? row
        : {
            // eslint-disable-next-line no-underscore-dangle
            __timestamp: row.__timestamp,
            Boston: row.Boston,
            California: row.California,
            WestTexNewMexico: row.WestTexNewMexico,
          },
    )
    .filter(row => forecastEnabled || !!row.Boston);
  return (
    <SuperChart
      chartType="echarts-timeseries"
      width={width}
      height={height}
      queriesData={[
        { data: queryData, colnames: ['__timestamp'], coltypes: [2] },
      ]}
      formData={{
        forecastEnabled,
        color_scheme: 'supersetColors',
        seriesType,
        logAxis,
        y_axis_format: 'SMART_NUMBER',
        stack,
        show_value: showValue,
        only_total: onlyTotal,
        percentage_threshold: percentageThreshold,
        area,
        markerEnabled,
        markerSize,
        minorSplitLine,
        opacity,
        zoomable,
        x_axis: '__timestamp',
      }}
    />
  );
};

Timeseries.args = {
  forecastEnabled: true,
  seriesType: 'line',
  logAxis: false,
  stack: false,
  showValue: false,
  onlyTotal: false,
  percentageThreshold: 0,
  area: false,
  markerEnabled: false,
  markerSize: 6,
  minorSplitLine: false,
  opacity: 0.2,
  zoomable: false,
};

Timeseries.argTypes = {
  forecastEnabled: { control: 'boolean' },
  seriesType: {
    control: 'select',
    options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
  },
  logAxis: { control: 'boolean' },
  stack: { control: 'boolean' },
  showValue: { control: 'boolean' },
  onlyTotal: { control: 'boolean' },
  percentageThreshold: { control: 'number' },
  area: { control: 'boolean' },
  markerEnabled: { control: 'boolean' },
  markerSize: { control: 'number' },
  minorSplitLine: { control: 'boolean' },
  opacity: { control: 'number' },
  zoomable: { control: 'boolean' },
};

export const WithNegativeNumbers = (
  {
    seriesType,
    stack,
    onlyTotal,
    orientation,
  }: {
    seriesType: string;
    stack: boolean;
    onlyTotal: boolean;
    orientation: string;
  },
  { width, height }: { width: number; height: number },
) => (
  <SuperChart
    chartType="echarts-timeseries"
    width={width}
    height={height}
    queriesData={[
      { data: negativeNumData, colnames: ['__timestamp'], coltypes: [2] },
    ]}
    formData={{
      color_scheme: 'supersetColors',
      seriesType,
      y_axis_format: '$,.2f',
      stack,
      show_value: true,
      show_legend: true,
      only_total: onlyTotal,
      orientation,
      x_axis: '__timestamp',
    }}
  />
);

WithNegativeNumbers.args = {
  seriesType: 'line',
  stack: true,
  onlyTotal: true,
  orientation: 'vertical',
};
WithNegativeNumbers.argTypes = {
  seriesType: {
    control: 'select',
    options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
  },
  stack: { control: 'boolean' },
  onlyTotal: { control: 'boolean' },
  orientation: { control: 'select', options: ['vertical', 'horizontal'] },
};

export const ConfidenceBand = ({ width, height }) => (
  <SuperChart
    chartType="echarts-timeseries"
    width={width}
    height={height}
    queriesData={[
      {
        data: confbandData,
        colnames: [
          'ds',
          'SUM(num)',
          'SUM(num)__yhat_lower',
          'SUM(num)__yhat_upper',
        ],
        coltypes: [2, 0, 0, 0],
      },
    ]}
    formData={{
      color_scheme: 'supersetColors',
      series_type: 'line',
      x_axis_time_format: 'smart_date',
      x_axis: 'ds',
    }}
  />
);

export const StackWithNulls = ({ width, height }) => (
  <SuperChart
    chartType="echarts-timeseries"
    width={width}
    height={height}
    queriesData={[
      {
        data: stackWithNullsData,
        colnames: ['ds', '1', '2'],
        coltypes: [2, 0, 0],
      },
    ]}
    formData={{
      color_scheme: 'supersetColors',
      series_type: 'bar',
      stack: true,
      x_axis_time_format: 'smart_date',
      x_axis: 'ds',
    }}
  />
);
