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
import {
  boolean,
  number,
  text,
  select,
  withKnobs,
} from '@storybook/addon-knobs';
import {
  EchartsTimeseriesChartPlugin,
  MixedTimeseriesTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from '../Timeseries/data';
import negativeNumData from './negativeData';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTimeseriesChartPlugin()
  .configure({ key: 'mixed-timeseries' })
  .register();

getChartTransformPropsRegistry().registerValue(
  'mixed-timeseries',
  MixedTimeseriesTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/MixedTimeseries',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Timeseries = ({ width, height }) => {
  const queriesData = [
    {
      data: data
        .map(row => ({
          // eslint-disable-next-line no-underscore-dangle
          __timestamp: row.__timestamp,
          Boston: row.Boston,
        }))
        .filter(row => !!row.Boston),
      colnames: ['__timestamp'],
      coltypes: [2],
    },
    {
      data: data
        .map(row => ({
          // eslint-disable-next-line no-underscore-dangle
          __timestamp: row.__timestamp,
          California: row.California,
          WestTexNewMexico: row.WestTexNewMexico,
        }))
        .filter(row => !!row.California),
    },
  ];
  return (
    <SuperChart
      chartType="mixed-timeseries"
      width={width}
      height={height}
      queriesData={queriesData}
      formData={{
        contributionMode: undefined,
        colorScheme: 'supersetColors',
        zoomable: boolean('Zoomable', false),
        logAxis: boolean('Log axis', false),
        xAxisTimeFormat: 'smart_date',
        tooltipTimeFormat: 'smart_date',
        yAxisFormat: select(
          'y-axis format',
          ['$,.2f', 'SMART_NUMBER'],
          '$,.2f',
        ),
        yAxisTitle: text('Y Axis title', ''),
        yAxisIndexB: select('yAxisIndexB', [0, 1], 1),
        minorSplitLine: boolean('Query 1: Minor splitline', false),
        seriesType: select(
          'Query 1: Line type',
          ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
          'line',
        ),
        stack: boolean('Query 1: Stack', false),
        area: boolean('Query 1: Area chart', false),
        markerEnabled: boolean('Query 1: Enable markers', false),
        markerSize: number('Query 1: Marker Size', 6),
        opacity: number('Query 1: Opacity', 0.2),
        seriesTypeB: select(
          'Query 2: Line type',
          ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
          'bar',
        ),
        stackB: boolean('Query 2: Stack', false),
        areaB: boolean('Query 2: Area chart', false),
        markerEnabledB: boolean('Query 2: Enable markers', false),
        markerSizeB: number('Query 2: Marker Size', 6),
        opacityB: number('Query 2: Opacity', 0.2),
        showValue: true,
      }}
    />
  );
};

export const WithNegativeNumbers = ({ width, height }) => (
  <SuperChart
    chartType="mixed-timeseries"
    width={width}
    height={height}
    queriesData={[
      {
        data: negativeNumData,
        colnames: ['__timestamp'],
        coltypes: [2],
      },
      {
        data: negativeNumData.map(({ __timestamp, Boston }) => ({
          __timestamp,
          avgRate: Boston / 100,
        })),
      },
    ]}
    formData={{
      contributionMode: undefined,
      colorScheme: 'supersetColors',
      seriesType: select(
        'Line type',
        ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
        'line',
      ),
      xAxisTimeFormat: 'smart_date',
      yAxisFormat: select(
        'y-axis format',
        {
          'Original value': '~g',
          'Smart number': 'SMART_NUMBER',
          '(12345.432 => $12,345.43)': '$,.2f',
        },
        '$,.2f',
      ),
      stack: true,
      showValue: boolean('Query 1: Show Value', true),
      showValueB: boolean('Query 2: Show Value', false),
      showLegend: true,
      markerEnabledB: true,
      yAxisIndexB: select(
        'Query 2: Y Axis',
        {
          Primary: 0,
          Secondary: 1,
        },
        1,
      ),
    }}
  />
);
