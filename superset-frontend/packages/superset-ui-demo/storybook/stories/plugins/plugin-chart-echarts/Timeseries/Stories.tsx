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

import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { boolean, number, select, withKnobs } from '@storybook/addon-knobs';
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
  title: 'Chart Plugins/plugin-chart-echarts/Timeseries',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Timeseries = ({ width, height }) => {
  const forecastEnabled = boolean('Enable forecast', true);
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
        seriesType: select(
          'Line type',
          ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
          'line',
        ),
        logAxis: boolean('Log axis', false),
        y_axis_format: 'SMART_NUMBER',
        stack: boolean('Stack', false),
        show_value: boolean('Show Values', false),
        only_total: boolean('Only Total', false),
        percentage_threshold: number('Percentage Threshold', 0),
        area: boolean('Area chart', false),
        markerEnabled: boolean('Enable markers', false),
        markerSize: number('Marker Size', 6),
        minorSplitLine: boolean('Minor splitline', false),
        opacity: number('Opacity', 0.2),
        zoomable: boolean('Zoomable', false),
        x_axis: '__timestamp',
      }}
    />
  );
};

export const WithNegativeNumbers = ({ width, height }) => (
  <SuperChart
    chartType="echarts-timeseries"
    width={width}
    height={height}
    queriesData={[
      { data: negativeNumData, colnames: ['__timestamp'], coltypes: [2] },
    ]}
    formData={{
      color_scheme: 'supersetColors',
      seriesType: select(
        'Line type',
        ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
        'line',
      ),
      y_axis_format: '$,.2f',
      stack: boolean('Stack', true),
      show_value: true,
      show_legend: true,
      only_total: boolean('Only Total', true),
      orientation: select(
        'Orientation',
        ['vertical', 'horizontal'],
        'vertical',
      ),
      x_axis: '__timestamp',
    }}
  />
);

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
