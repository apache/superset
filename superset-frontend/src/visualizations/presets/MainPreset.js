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
  isFeatureEnabled,
  FeatureFlag,
  Preset,
  VizType,
} from '@superset-ui/core';
import TableChartPlugin from '@superset-ui/plugin-chart-table';
import { WordCloudChartPlugin } from '@superset-ui/plugin-chart-word-cloud';
import {
  BigNumberChartPlugin,
  BigNumberTotalChartPlugin,
  EchartsPieChartPlugin,
  EchartsBoxPlotChartPlugin,
  EchartsAreaChartPlugin,
  EchartsTimeseriesChartPlugin,
  EchartsTimeseriesBarChartPlugin,
  EchartsTimeseriesLineChartPlugin,
  EchartsTimeseriesScatterChartPlugin,
  EchartsTimeseriesSmoothLineChartPlugin,
  EchartsTimeseriesStepChartPlugin,
  EchartsGraphChartPlugin,
  EchartsGaugeChartPlugin,
  EchartsHistogramChartPlugin,
  EchartsRadarChartPlugin,
  EchartsFunnelChartPlugin,
  EchartsSankeyChartPlugin,
  EchartsTreemapChartPlugin,
  EchartsMixedTimeseriesChartPlugin,
  EchartsTreeChartPlugin,
  EchartsSunburstChartPlugin,
  EchartsBubbleChartPlugin,
  EchartsWaterfallChartPlugin,
  BigNumberPeriodOverPeriodChartPlugin,
  EchartsHeatmapChartPlugin,
} from '@superset-ui/plugin-chart-echarts';
import {
  SelectFilterPlugin,
  RangeFilterPlugin,
  TimeFilterPlugin,
  TimeColumnFilterPlugin,
  TimeGrainFilterPlugin,
} from 'src/filters/components';
import { PivotTableChartPlugin as PivotTableChartPluginV2 } from '@superset-ui/plugin-chart-pivot-table';
import { HandlebarsChartPlugin } from '@superset-ui/plugin-chart-handlebars';
import { FilterPlugins } from 'src/constants';
import TimeTableChartPlugin from '../TimeTable';

export default class MainPreset extends Preset {
  constructor() {
    const experimentalPlugins = isFeatureEnabled(
      FeatureFlag.ChartPluginsExperimental,
    )
      ? [
          new BigNumberPeriodOverPeriodChartPlugin().configure({
            key: VizType.BigNumberPeriodOverPeriod,
          }),
        ]
      : [];

    super({
      name: 'Legacy charts',
      plugins: [
        new BigNumberChartPlugin().configure({ key: VizType.BigNumber }),
        new BigNumberTotalChartPlugin().configure({
          key: VizType.BigNumberTotal,
        }),
        new EchartsBoxPlotChartPlugin().configure({ key: VizType.BoxPlot }),
        new EchartsFunnelChartPlugin().configure({ key: VizType.Funnel }),
        new EchartsSankeyChartPlugin().configure({ key: VizType.Sankey }),
        new EchartsTreemapChartPlugin().configure({ key: VizType.Treemap }),
        new EchartsGaugeChartPlugin().configure({ key: VizType.Gauge }),
        new EchartsGraphChartPlugin().configure({ key: VizType.Graph }),
        new EchartsRadarChartPlugin().configure({ key: VizType.Radar }),
        new EchartsMixedTimeseriesChartPlugin().configure({
          key: VizType.MixedTimeseries,
        }),
        new EchartsPieChartPlugin().configure({ key: VizType.Pie }),
        new PivotTableChartPluginV2().configure({ key: VizType.PivotTable }),
        new TableChartPlugin().configure({ key: VizType.Table }),
        new TimeTableChartPlugin().configure({ key: VizType.TimeTable }),
        new WordCloudChartPlugin().configure({ key: VizType.WordCloud }),
        new EchartsAreaChartPlugin().configure({
          key: VizType.Area,
        }),
        new EchartsTimeseriesChartPlugin().configure({
          key: VizType.Timeseries,
        }),
        new EchartsTimeseriesBarChartPlugin().configure({
          key: VizType.Bar,
        }),
        new EchartsTimeseriesLineChartPlugin().configure({
          key: VizType.Line,
        }),
        new EchartsTimeseriesSmoothLineChartPlugin().configure({
          key: VizType.SmoothLine,
        }),
        new EchartsTimeseriesScatterChartPlugin().configure({
          key: VizType.Scatter,
        }),
        new EchartsTimeseriesStepChartPlugin().configure({
          key: VizType.Step,
        }),
        new EchartsWaterfallChartPlugin().configure({
          key: VizType.Waterfall,
        }),
        new EchartsHeatmapChartPlugin().configure({ key: VizType.Heatmap }),
        new EchartsHistogramChartPlugin().configure({ key: VizType.Histogram }),
        new SelectFilterPlugin().configure({ key: FilterPlugins.Select }),
        new RangeFilterPlugin().configure({ key: FilterPlugins.Range }),
        new TimeFilterPlugin().configure({ key: FilterPlugins.Time }),
        new TimeColumnFilterPlugin().configure({
          key: FilterPlugins.TimeColumn,
        }),
        new TimeGrainFilterPlugin().configure({
          key: FilterPlugins.TimeGrain,
        }),
        new EchartsTreeChartPlugin().configure({ key: VizType.Tree }),
        new EchartsSunburstChartPlugin().configure({ key: VizType.Sunburst }),
        new HandlebarsChartPlugin().configure({ key: VizType.Handlebars }),
        new EchartsBubbleChartPlugin().configure({ key: VizType.Bubble }),
        ...experimentalPlugins,
      ],
    });
  }
}
