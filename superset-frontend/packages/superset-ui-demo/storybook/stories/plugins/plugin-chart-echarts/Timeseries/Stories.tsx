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
import { EchartsTimeseriesChartPlugin, TimeseriesTransformProps } from '@superset-ui/plugin-chart-echarts';
import data from './data';
import negativeNumData from './negativeNumData';
import confbandData from './confbandData';
import stackWithNullsData from './stackWithNulls';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTimeseriesChartPlugin().configure({ key: 'echarts-timeseries' }).register();
getChartTransformPropsRegistry().registerValue('echarts-timeseries', TimeseriesTransformProps);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Timeseries',
  decorators: [withResizableChartDemo],
  argTypes: {
    width: { control: 'text', defaultValue: '100%' },
    height: { control: 'text', defaultValue: '100%' },
    forecastEnabled: { control: 'boolean' },
    seriesType: { control: 'select', options: ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'] },
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
    // You might need to add more argTypes for other controls specific to each chart
  },
};

const TimeseriesTemplate = (args) => (
  <SuperChart
    chartType="echarts-timeseries"
    width={args.width}
    height={args.height}
    queriesData={[{ data: args.forecastEnabled ? data : data.map(d => ({ ...d, forecast: null })) }]}
    formData={{
      colorScheme: 'supersetColors',
      seriesType: args.seriesType || 'line',
      logAxis: args.logAxis || false,
      stack: args.stack || false,
      showValue: args.showValue || false,
      onlyTotal: args.onlyTotal || false,
      percentageThreshold: args.percentageThreshold || 0,
      area: args.area || false,
      markerEnabled: args.markerEnabled || false,
      markerSize: args.markerSize || 6,
      minorSplitLine: args.minorSplitLine || false,
      opacity: args.opacity || 0.2,
      zoomable: args.zoomable || false,
      // Additional formData properties might be needed here
    }}
  />
);

export const Timeseries = TimeseriesTemplate.bind({});
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

// WithNegativeNumbers Story
export const WithNegativeNumbers = TimeseriesTemplate.bind({});
WithNegativeNumbers.args = {
  width: '100%',
  height: '400px', // Adjust based on your layout
  forecastEnabled: false, // Assuming you use this to toggle data
  seriesType: 'line',
  logAxis: false,
  stack: true,
  showValue: true,
  onlyTotal: true,
  percentageThreshold: 0,
  area: false,
  markerEnabled: false,
  markerSize: 6,
  minorSplitLine: false,
  opacity: 0.2,
  zoomable: false,
  // Since the data is different for WithNegativeNumbers, you might need to adjust the template or args accordingly
};

// ConfidenceBand Story
export const ConfidenceBand = TimeseriesTemplate.bind({});
ConfidenceBand.args = {
  width: '100%',
  height: '400px',
  forecastEnabled: true, // Adjust if needed
  seriesType: 'line',
  // Add other properties specific to the ConfidenceBand visualization
  // Note: You might need to adjust data handling in the template for specific chart types
};

// StackWithNulls Story
export const StackWithNulls = TimeseriesTemplate.bind({});
StackWithNulls.args = {
  width: '100%',
  height: '400px',
  forecastEnabled: false, // Adjust if needed
  seriesType: 'bar',
  stack: true,
  // Add other properties specific to the StackWithNulls visualization
  // Note: Similarly, ensure data handling in the template accommodates this chart's needs
};
