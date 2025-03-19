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
  decorators: [withResizableChartDemo],
};

export const Timeseries = (
  {
    zoomable,
    logAxis,
    yAxisFormat,
    yAxisTitle,
    yAxisIndexB,
    minorSplitLine,
    seriesType,
    stack,
    area,
    markerEnabled,
    markerSize,
    opacity,
    seriesTypeB,
    stackB,
    areaB,
    markerEnabledB,
    markerSizeB,
    opacityB,
  }: {
    zoomable: boolean;
    logAxis: boolean;
    yAxisFormat: string;
    yAxisTitle: string;
    yAxisIndexB: number;
    minorSplitLine: boolean;
    seriesType: string;
    stack: boolean;
    area: boolean;
    markerEnabled: boolean;
    markerSize: number;
    opacity: number;
    seriesTypeB: string;
    stackB: boolean;
    areaB: boolean;
    markerEnabledB: boolean;
    markerSizeB: number;
    opacityB: number;
  },
  { width, height }: { width: number; height: number },
) => {
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
        zoomable,
        logAxis,
        xAxisTimeFormat: 'smart_date',
        tooltipTimeFormat: 'smart_date',
        yAxisFormat,
        yAxisTitle,
        yAxisIndexB,
        minorSplitLine,
        seriesType,
        stack,
        area,
        markerEnabled,
        markerSize,
        opacity,
        seriesTypeB,
        stackB,
        areaB,
        markerEnabledB,
        markerSizeB,
        opacityB,
        showValue: true,
      }}
    />
  );
};

Timeseries.args = {
  zoomable: false,
  logAxis: false,
  yAxisFormat: '$,.2f',
  yAxisTitle: '',
  yAxisIndexB: 1,
  minorSplitLine: false,
  seriesType: 'line',
  stack: false,
  area: false,
  markerSize: 6,
  opacity: 0.2,
  seriesTypeB: 'bar',
  stackB: false,
  areaB: false,
  markerEnabledB: false,
  markerSizeB: 6,
  opacityB: 0.2,
};

Timeseries.argTypes = {
  zoomable: {
    control: 'boolean',
    description: 'Zoomable',
    defaultValue: false,
  },
  logAxis: {
    control: 'boolean',
    description: 'Log axis',
    defaultValue: false,
  },
  yAxisFormat: {
    control: 'select',
    description: 'Y Axis format',
    options: ['$,.2f', 'SMART_NUMBER'],
    defaultValue: '$,.2f',
  },
  yAxisTitle: {
    control: 'text',
    description: 'Y Axis title',
    defaultValue: '',
  },
  yAxisIndexB: {
    control: 'select',
    description: 'Y Axis index for Query 2',
    options: [0, 1],
    defaultValue: 1,
  },
  minorSplitLine: {
    control: 'boolean',
    description: 'Query 1: Minor splitline',
    defaultValue: false,
  },
  seriesType: {
    control: 'select',
    description: 'Query 1: Line type',
    options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
    defaultValue: 'line',
  },
  stack: {
    control: 'boolean',
    description: 'Query 1: Stack',
    defaultValue: false,
  },
  area: {
    control: 'boolean',
    description: 'Query 1: Area chart',
    defaultValue: false,
  },
  markerEnabled: {
    control: 'boolean',
    description: 'Query 1: Enable markers',
    defaultValue: false,
  },
  markerSize: {
    control: 'number',
    description: 'Query 1: Marker Size',
    defaultValue: 6,
  },
  opacity: {
    control: 'number',
    description: 'Query 1: Opacity',
    defaultValue: 0.2,
  },
  seriesTypeB: {
    control: 'select',
    description: 'Query 2: Line type',
    options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
    defaultValue: 'bar',
  },
  stackB: {
    control: 'boolean',
    description: 'Query 2: Stack',
    defaultValue: false,
  },
  areaB: {
    control: 'boolean',
    description: 'Query 2: Area chart',
    defaultValue: false,
  },
  markerEnabledB: {
    control: 'boolean',
    description: 'Query 2: Enable markers',
    defaultValue: false,
  },
  markerSizeB: {
    control: 'number',
    description: 'Query 2: Marker Size',
    defaultValue: 6,
  },
  opacityB: {
    control: 'number',
    description: 'Query 2: Opacity',
    defaultValue: 0.2,
  },
};

export const WithNegativeNumbers = (
  {
    seriesType,
    yAxisFormat,
    showValue,
    showValueB,
    yAxisIndexB,
  }: {
    seriesType: string;
    yAxisFormat: string;
    showValue: boolean;
    showValueB: boolean;
    yAxisIndexB: number;
  },
  { width, height }: { width: number; height: number },
) => (
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
      seriesType,
      xAxisTimeFormat: 'smart_date',
      yAxisFormat,
      stack: true,
      showValue,
      showValueB,
      showLegend: true,
      markerEnabledB: true,
      yAxisIndexB,
    }}
  />
);

WithNegativeNumbers.args = {
  width: 400,
  height: 400,
  seriesType: 'line',
  yAxisFormat: '$,.2f',
  showValue: true,
  showValueB: false,
  yAxisIndexB: 1,
};

WithNegativeNumbers.argTypes = {
  seriesType: {
    control: 'select',
    options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
  },
  yAxisFormat: {
    control: 'select',
    options: {
      'Original value': '~g',
      'Smart number': 'SMART_NUMBER',
      '(12345.432 => $12,345.43)': '$,.2f',
    },
  },
  showValue: {
    control: 'boolean',
    description: 'Query 1: Show Value',
    defaultValue: true,
  },
  showValueB: {
    control: 'boolean',
    description: 'Query 2: Show Value',
    defaultValue: false,
  },
  yAxisIndexB: {
    control: 'select',
    description: 'Query 2: Y Axis',
    options: {
      Primary: 0,
      Secondary: 1,
    },
    defaultValue: 1,
  },
};
