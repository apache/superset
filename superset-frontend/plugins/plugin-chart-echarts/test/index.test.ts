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
import { VizType } from '@superset-ui/core';
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
      key: VizType.BoxPlot,
    }),
    new EchartsPieChartPlugin().configure({
      key: VizType.Pie,
    }),
    new EchartsTimeseriesChartPlugin().configure({
      key: VizType.Timeseries,
    }),
    new EchartsGraphChartPlugin().configure({
      key: VizType.Graph,
    }),
    new EchartsFunnelChartPlugin().configure({
      key: VizType.Funnel,
    }),
    new EchartsTreemapChartPlugin().configure({
      key: VizType.Treemap,
    }),
    new EchartsAreaChartPlugin().configure({
      key: VizType.Area,
    }),
    new EchartsTimeseriesBarChartPlugin().configure({
      key: VizType.Bar,
    }),
    new EchartsTimeseriesLineChartPlugin().configure({
      key: VizType.Line,
    }),
    new EchartsTimeseriesScatterChartPlugin().configure({
      key: VizType.Scatter,
    }),
    new EchartsTimeseriesSmoothLineChartPlugin().configure({
      key: VizType.SmoothLine,
    }),
    new EchartsTimeseriesStepChartPlugin().configure({
      key: VizType.Step,
    }),
    new EchartsMixedTimeseriesChartPlugin().configure({
      key: VizType.MixedTimeseries,
    }),
    new EchartsGaugeChartPlugin().configure({
      key: VizType.Gauge,
    }),
    new EchartsRadarChartPlugin().configure({
      key: VizType.Radar,
    }),
    new EchartsTreeChartPlugin().configure({
      key: 'tree',
    }),
    new BigNumberChartPlugin().configure({
      key: VizType.BigNumber,
    }),
    new BigNumberTotalChartPlugin().configure({
      key: VizType.BigNumberTotal,
    }),
    new EchartsSunburstChartPlugin().configure({
      key: 'sunburst',
    }),
  ];

  plugins.forEach(plugin => {
    expect(plugin.metadata.parseMethod).toEqual('json');
  });
});
