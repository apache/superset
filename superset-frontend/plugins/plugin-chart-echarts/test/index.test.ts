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
import {
  EchartsBoxPlotChartPlugin,
  EchartsPieChartPlugin,
  EchartsTimeseriesChartPlugin,
  EchartsGraphChartPlugin,
  EchartsFunnelChartPlugin,
  EchartsTreemapChartPlugin,
  EchartsAreaChartPlugin,
  EchartsTimeseriesBarChartPlugin,
  EchartsTimeseriesLineChartPlugin,
  EchartsTimeseriesScatterChartPlugin,
  EchartsTimeseriesSmoothLineChartPlugin,
  EchartsTimeseriesStepChartPlugin,
  EchartsMixedTimeseriesChartPlugin,
  EchartsGaugeChartPlugin,
  EchartsRadarChartPlugin,
  EchartsTreeChartPlugin,
  BigNumberChartPlugin,
  BigNumberTotalChartPlugin,
  EchartsSunburstChartPlugin,
} from '../src';

import { EchartsChartPlugin } from '../src/types';

test('@superset-ui/plugin-chart-echarts exists', () => {
  expect(EchartsBoxPlotChartPlugin).toBeDefined();
  expect(EchartsPieChartPlugin).toBeDefined();
  expect(EchartsTimeseriesChartPlugin).toBeDefined();
  expect(EchartsGraphChartPlugin).toBeDefined();
  expect(EchartsFunnelChartPlugin).toBeDefined();
  expect(EchartsTreemapChartPlugin).toBeDefined();
  expect(EchartsAreaChartPlugin).toBeDefined();
  expect(EchartsTimeseriesBarChartPlugin).toBeDefined();
  expect(EchartsTimeseriesLineChartPlugin).toBeDefined();
  expect(EchartsTimeseriesScatterChartPlugin).toBeDefined();
  expect(EchartsTimeseriesSmoothLineChartPlugin).toBeDefined();
  expect(EchartsTimeseriesStepChartPlugin).toBeDefined();
  expect(EchartsMixedTimeseriesChartPlugin).toBeDefined();
  expect(EchartsGaugeChartPlugin).toBeDefined();
  expect(EchartsRadarChartPlugin).toBeDefined();
  expect(EchartsTreeChartPlugin).toBeDefined();
  expect(BigNumberChartPlugin).toBeDefined();
  expect(BigNumberTotalChartPlugin).toBeDefined();
  expect(EchartsSunburstChartPlugin).toBeDefined();
});

test('@superset-ui/plugin-chart-echarts-parsemethod-validation', () => {
  const plugins: EchartsChartPlugin[] = [
    new EchartsBoxPlotChartPlugin().configure({
      key: 'box_plot',
    }),
    new EchartsPieChartPlugin().configure({
      key: 'pie',
    }),
    new EchartsTimeseriesChartPlugin().configure({
      key: 'echarts_timeseries',
    }),
    new EchartsGraphChartPlugin().configure({
      key: 'graph_chart',
    }),
    new EchartsFunnelChartPlugin().configure({
      key: 'funnel',
    }),
    new EchartsTreemapChartPlugin().configure({
      key: 'treemap_v2',
    }),
    new EchartsAreaChartPlugin().configure({
      key: 'echarts_area',
    }),
    new EchartsTimeseriesBarChartPlugin().configure({
      key: 'echarts_timeseries_bar',
    }),
    new EchartsTimeseriesLineChartPlugin().configure({
      key: 'echarts_timeseries_line',
    }),
    new EchartsTimeseriesScatterChartPlugin().configure({
      key: 'echarts_timeseries_scatter',
    }),
    new EchartsTimeseriesSmoothLineChartPlugin().configure({
      key: 'echarts_timeseries_smooth',
    }),
    new EchartsTimeseriesStepChartPlugin().configure({
      key: 'echarts_timeseries_step',
    }),
    new EchartsMixedTimeseriesChartPlugin().configure({
      key: 'mixed_timeseries',
    }),
    new EchartsGaugeChartPlugin().configure({
      key: 'gauge_chart',
    }),
    new EchartsRadarChartPlugin().configure({
      key: 'radar',
    }),
    new EchartsTreeChartPlugin().configure({
      key: 'tree',
    }),
    new BigNumberChartPlugin().configure({
      key: 'big_number',
    }),
    new BigNumberTotalChartPlugin().configure({
      key: 'big_number_total',
    }),
    new EchartsSunburstChartPlugin().configure({
      key: 'sunburst',
    }),
  ];

  plugins.forEach(plugin => {
    expect(plugin.metadata.parseMethod).toEqual('json');
  });
});
