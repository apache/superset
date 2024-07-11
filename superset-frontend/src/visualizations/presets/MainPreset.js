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
import { isFeatureEnabled, FeatureFlag, Preset } from '@superset-ui/core';
import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';
import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';
import CountryMapChartPlugin from '@superset-ui/legacy-plugin-chart-country-map';
import EventFlowChartPlugin from '@superset-ui/legacy-plugin-chart-event-flow';
import HeatmapChartPlugin from '@superset-ui/legacy-plugin-chart-heatmap';
import HistogramChartPlugin from '@superset-ui/legacy-plugin-chart-histogram';
import HorizonChartPlugin from '@superset-ui/legacy-plugin-chart-horizon';
import MapBoxChartPlugin from '@superset-ui/legacy-plugin-chart-map-box';
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';
import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';
import PartitionChartPlugin from '@superset-ui/legacy-plugin-chart-partition';
import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';
import SankeyChartPlugin from '@superset-ui/legacy-plugin-chart-sankey';
import TableChartPlugin from '@superset-ui/plugin-chart-table';
import { WordCloudChartPlugin } from '@superset-ui/plugin-chart-word-cloud';
import WorldMapChartPlugin from '@superset-ui/legacy-plugin-chart-world-map';
import {
  AreaChartPlugin,
  BarChartPlugin,
  BubbleChartPlugin,
  BulletChartPlugin,
  CompareChartPlugin,
  DistBarChartPlugin,
  LineChartPlugin,
  TimePivotChartPlugin,
} from '@superset-ui/legacy-preset-chart-nvd3';
import { DeckGLChartPreset } from '@superset-ui/legacy-preset-chart-deckgl';
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
            key: 'pop_kpi',
          }),
        ]
      : [];

    super({
      name: 'Legacy charts',
      presets: [new DeckGLChartPreset()],
      plugins: [
        new AreaChartPlugin().configure({ key: 'area' }),
        new BarChartPlugin().configure({ key: 'bar' }),
        new BigNumberChartPlugin().configure({ key: 'big_number' }),
        new BigNumberTotalChartPlugin().configure({ key: 'big_number_total' }),
        new EchartsBoxPlotChartPlugin().configure({ key: 'box_plot' }),
        new BubbleChartPlugin().configure({ key: 'bubble' }),
        new BulletChartPlugin().configure({ key: 'bullet' }),
        new CalendarChartPlugin().configure({ key: 'cal_heatmap' }),
        new ChordChartPlugin().configure({ key: 'chord' }),
        new CompareChartPlugin().configure({ key: 'compare' }),
        new CountryMapChartPlugin().configure({ key: 'country_map' }),
        new DistBarChartPlugin().configure({ key: 'dist_bar' }),
        new EventFlowChartPlugin().configure({ key: 'event_flow' }),
        new EchartsFunnelChartPlugin().configure({ key: 'funnel' }),
        new EchartsSankeyChartPlugin().configure({ key: 'sankey_v2' }),
        new EchartsTreemapChartPlugin().configure({ key: 'treemap_v2' }),
        new EchartsGaugeChartPlugin().configure({ key: 'gauge_chart' }),
        new EchartsGraphChartPlugin().configure({ key: 'graph_chart' }),
        new EchartsRadarChartPlugin().configure({ key: 'radar' }),
        new EchartsMixedTimeseriesChartPlugin().configure({
          key: 'mixed_timeseries',
        }),
        new HeatmapChartPlugin().configure({ key: 'heatmap' }),
        new HistogramChartPlugin().configure({ key: 'histogram' }),
        new HorizonChartPlugin().configure({ key: 'horizon' }),
        new LineChartPlugin().configure({ key: 'line' }),
        new MapBoxChartPlugin().configure({ key: 'mapbox' }),
        new PairedTTestChartPlugin().configure({ key: 'paired_ttest' }),
        new ParallelCoordinatesChartPlugin().configure({ key: 'para' }),
        new PartitionChartPlugin().configure({ key: 'partition' }),
        new EchartsPieChartPlugin().configure({ key: 'pie' }),
        new PivotTableChartPluginV2().configure({ key: 'pivot_table_v2' }),
        new RoseChartPlugin().configure({ key: 'rose' }),
        new SankeyChartPlugin().configure({ key: 'sankey' }),
        new TableChartPlugin().configure({ key: 'table' }),
        new TimePivotChartPlugin().configure({ key: 'time_pivot' }),
        new TimeTableChartPlugin().configure({ key: 'time_table' }),
        new WordCloudChartPlugin().configure({ key: 'word_cloud' }),
        new WorldMapChartPlugin().configure({ key: 'world_map' }),
        new EchartsAreaChartPlugin().configure({
          key: 'echarts_area',
        }),
        new EchartsTimeseriesChartPlugin().configure({
          key: 'echarts_timeseries',
        }),
        new EchartsTimeseriesBarChartPlugin().configure({
          key: 'echarts_timeseries_bar',
        }),
        new EchartsTimeseriesLineChartPlugin().configure({
          key: 'echarts_timeseries_line',
        }),
        new EchartsTimeseriesSmoothLineChartPlugin().configure({
          key: 'echarts_timeseries_smooth',
        }),
        new EchartsTimeseriesScatterChartPlugin().configure({
          key: 'echarts_timeseries_scatter',
        }),
        new EchartsTimeseriesStepChartPlugin().configure({
          key: 'echarts_timeseries_step',
        }),
        new EchartsWaterfallChartPlugin().configure({
          key: 'waterfall',
        }),
        new EchartsHeatmapChartPlugin().configure({ key: 'heatmap_v2' }),
        new EchartsHistogramChartPlugin().configure({ key: 'histogram_v2' }),
        new SelectFilterPlugin().configure({ key: FilterPlugins.Select }),
        new RangeFilterPlugin().configure({ key: FilterPlugins.Range }),
        new TimeFilterPlugin().configure({ key: FilterPlugins.Time }),
        new TimeColumnFilterPlugin().configure({
          key: FilterPlugins.TimeColumn,
        }),
        new TimeGrainFilterPlugin().configure({
          key: FilterPlugins.TimeGrain,
        }),
        new EchartsTreeChartPlugin().configure({ key: 'tree_chart' }),
        new EchartsSunburstChartPlugin().configure({ key: 'sunburst_v2' }),
        new HandlebarsChartPlugin().configure({ key: 'handlebars' }),
        new EchartsBubbleChartPlugin().configure({ key: 'bubble_v2' }),
        ...experimentalPlugins,
      ],
    });
  }
}
