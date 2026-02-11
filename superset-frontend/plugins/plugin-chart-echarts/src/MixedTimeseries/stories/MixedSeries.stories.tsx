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
import { supersetTheme } from '@apache-superset/core/ui';
import {
  EchartsTimeseriesChartPlugin,
  MixedTimeseriesTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from '../../Timeseries/stories/data';
import negativeNumData from './negativeData';
import { withResizableChartDemo } from '@storybook-shared';

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

export const Timeseries = ({
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
  width,
  height,
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
  width: number;
  height: number;
}) => {
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
      theme={supersetTheme}
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
        metrics: [{ label: 'Boston' }],
        metricsB: [{ label: 'California' }, { label: 'WestTexNewMexico' }],
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
  },
  logAxis: {
    control: 'boolean',
    description: 'Log axis',
  },
  yAxisFormat: {
    control: 'select',
    description: 'Y Axis format',
    options: ['$,.2f', 'SMART_NUMBER'],
  },
  yAxisTitle: {
    control: 'text',
    description: 'Y Axis title',
  },
  yAxisIndexB: {
    control: 'select',
    description: 'Y Axis index for Query 2',
    options: [0, 1],
  },
  minorSplitLine: {
    control: 'boolean',
    description: 'Query 1: Minor splitline',
  },
  seriesType: {
    control: 'select',
    description: 'Query 1: Line type',
    options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
  },
  stack: {
    control: 'boolean',
    description: 'Query 1: Stack',
  },
  area: {
    control: 'boolean',
    description: 'Query 1: Area chart',
  },
  markerEnabled: {
    control: 'boolean',
    description: 'Query 1: Enable markers',
  },
  markerSize: {
    control: 'number',
    description: 'Query 1: Marker Size',
  },
  opacity: {
    control: 'number',
    description: 'Query 1: Opacity',
  },
  seriesTypeB: {
    control: 'select',
    description: 'Query 2: Line type',
    options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
  },
  stackB: {
    control: 'boolean',
    description: 'Query 2: Stack',
  },
  areaB: {
    control: 'boolean',
    description: 'Query 2: Area chart',
  },
  markerEnabledB: {
    control: 'boolean',
    description: 'Query 2: Enable markers',
  },
  markerSizeB: {
    control: 'number',
    description: 'Query 2: Marker Size',
  },
  opacityB: {
    control: 'number',
    description: 'Query 2: Opacity',
  },
};

export const WithNegativeNumbers = ({
  seriesType,
  yAxisFormat,
  showValue,
  showValueB,
  yAxisIndexB,
  width,
  height,
}: {
  seriesType: string;
  yAxisFormat: string;
  showValue: boolean;
  showValueB: boolean;
  yAxisIndexB: number;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
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
      metrics: [{ label: 'Boston' }],
      metricsB: [{ label: 'avgRate' }],
    }}
  />
);

WithNegativeNumbers.args = {
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
  },
  showValueB: {
    control: 'boolean',
    description: 'Query 2: Show Value',
  },
  yAxisIndexB: {
    control: 'select',
    description: 'Query 2: Y Axis',
    options: {
      Primary: 0,
      Secondary: 1,
    },
  },
};
