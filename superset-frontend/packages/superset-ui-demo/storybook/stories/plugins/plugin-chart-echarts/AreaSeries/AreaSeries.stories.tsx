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
  EchartsAreaChartPlugin,
  TimeseriesTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsAreaChartPlugin().configure({ key: 'echarts_area' }).register();

getChartTransformPropsRegistry().registerValue(
  'echarts_area',
  TimeseriesTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts',
  decorators: [withResizableChartDemo],
  component: SuperChart,
  parameters: {
    initialSize: { width: 500, height: 300 },
  },
  args: {
    forecastEnabled: true,
    seriesType: 'line',
    show_extra_controls: false,
    logAxis: false,
    stack: false,
    showValue: false,
    onlyTotal: false,
    percentageThreshold: 0,
    markerEnabled: false,
    markerSize: 6,
    minorSplitLine: false,
    opacity: 0.2,
    zoomable: false,
  },
  argTypes: {
    forecastEnabled: {
      control: 'boolean',
      description: 'Extra Forecast',
      defaultValue: false,
    },
    seriesType: {
      control: 'select',
      description: 'Line type',
      options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
    },
    show_extra_controls: {
      control: 'boolean',
      description: 'Extra Controls',
      defaultValue: false,
    },
    logAxis: {
      control: 'boolean',
      description: 'Log axis',
      defaultValue: false,
    },
    stack: {
      control: 'boolean',
      defaultValue: false,
    },
    showValue: {
      control: 'boolean',
      description: 'Show Values',
      defaultValue: false,
    },
    onlyTotal: {
      control: 'boolean',
      description: 'Only Total',
      defaultValue: false,
    },
    percentageThreshold: {
      control: { type: 'number', min: 0, max: 100, step: 1 },
      description: 'Percentage Threshold',
      defaultValue: 0,
    },
    markerEnabled: {
      control: 'boolean',
      description: 'Enable markers',
      defaultValue: false,
    },
    markerSize: {
      control: { type: 'number', min: 0, max: 100, step: 1 },
      description: 'Marker Size',
      defaultValue: 6,
    },
    minorSplitLine: {
      control: 'boolean',
      description: 'Minor splitline',
      defaultValue: false,
    },
    opacity: {
      control: { type: 'number', min: 0, max: 1, step: 0.1 },
      description: 'Opacity',
      defaultValue: 0.2,
    },
    zoomable: {
      control: 'boolean',
      description: 'Zoomable',
      defaultValue: false,
    },
  },
};

export const AreaSeries = (
  {
    forecastEnabled,
    seriesType,
    show_extra_controls,
    logAxis,
    stack,
    showValue,
    onlyTotal,
    percentageThreshold,
    markerEnabled,
    markerSize,
    minorSplitLine,
    opacity,
    zoomable,
  }: {
    forecastEnabled: boolean;
    seriesType: string;
    show_extra_controls: boolean;
    logAxis: boolean;
    stack: boolean;
    showValue: boolean;
    onlyTotal: boolean;
    percentageThreshold: number;
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
      chartType="echarts_area"
      width={width}
      height={height}
      queriesData={[{ data: queryData }]}
      formData={{
        area: true,
        contributionMode: undefined,
        forecastEnabled,
        colorScheme: 'supersetColors',
        seriesType,
        show_extra_controls,
        logAxis,
        yAxisFormat: 'SMART_NUMBER',
        stack,
        showValue,
        onlyTotal,
        percentageThreshold,
        markerEnabled,
        markerSize,
        minorSplitLine,
        opacity,
        zoomable,
      }}
    />
  );
};
