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
import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';
import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';
import CountryMapChartPlugin from '@superset-ui/legacy-plugin-chart-country-map';
import HorizonChartPlugin from '@superset-ui/legacy-plugin-chart-horizon';
import MapBoxChartPlugin from '@superset-ui/legacy-plugin-chart-map-box';
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';
import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';
import PartitionChartPlugin from '@superset-ui/legacy-plugin-chart-partition';
import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';
import TableChartPlugin from '@superset-ui/plugin-chart-table';
import { WordCloudChartPlugin } from '@superset-ui/plugin-chart-word-cloud';
import WorldMapChartPlugin from '@superset-ui/legacy-plugin-chart-world-map';
import {
  BubbleChartPlugin,
  BulletChartPlugin,
  CompareChartPlugin,
  TimePivotChartPlugin,
} from '@superset-ui/legacy-preset-chart-nvd3';
import { DeckGLChartPreset } from '@superset-ui/legacy-preset-chart-deckgl';
import { CartodiagramPlugin } from '@superset-ui/plugin-chart-cartodiagram';
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
      presets: [new DeckGLChartPreset()],
      plugins: [
        new BigNumberChartPlugin().configure({ key: VizType.BigNumber }),
        new BigNumberTotalChartPlugin().configure({
          key: VizType.BigNumberTotal,
        }),
        new EchartsBoxPlotChartPlugin().configure({ key: VizType.BoxPlot }),
        new BubbleChartPlugin().configure({ key: VizType.LegacyBubble }),
        new BulletChartPlugin().configure({ key: VizType.Bullet }),
        new CalendarChartPlugin().configure({ key: VizType.Calendar }),
        new ChordChartPlugin().configure({ key: VizType.Chord }),
        new CompareChartPlugin().configure({ key: VizType.Compare }),
        new CountryMapChartPlugin().configure({ key: VizType.CountryMap }),
        new EchartsFunnelChartPlugin().configure({ key: VizType.Funnel }),
        new EchartsSankeyChartPlugin().configure({ key: VizType.Sankey }),
        new EchartsTreemapChartPlugin().configure({ key: VizType.Treemap }),
        new EchartsGaugeChartPlugin().configure({ key: VizType.Gauge }),
        new EchartsGraphChartPlugin().configure({ key: VizType.Graph }),
        new EchartsRadarChartPlugin().configure({ key: VizType.Radar }),
        new EchartsMixedTimeseriesChartPlugin().configure({
          key: VizType.MixedTimeseries,
        }),
        new HorizonChartPlugin().configure({ key: VizType.Horizon }),
        new MapBoxChartPlugin().configure({ key: VizType.MapBox }),
        new PairedTTestChartPlugin().configure({ key: VizType.PairedTTest }),
        new ParallelCoordinatesChartPlugin().configure({
          key: VizType.ParallelCoordinates,
        }),
        new PartitionChartPlugin().configure({ key: VizType.Partition }),
        new EchartsPieChartPlugin().configure({ key: VizType.Pie }),
        new PivotTableChartPluginV2().configure({ key: VizType.PivotTable }),
        new RoseChartPlugin().configure({ key: VizType.Rose }),
        new TableChartPlugin().configure({ key: VizType.Table }),
        new TimePivotChartPlugin().configure({ key: VizType.TimePivot }),
        new TimeTableChartPlugin().configure({ key: VizType.TimeTable }),
        new WordCloudChartPlugin().configure({ key: VizType.WordCloud }),
        new WorldMapChartPlugin().configure({ key: VizType.WorldMap }),
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
        new CartodiagramPlugin({
          defaultLayers: [
            {
              type: 'WMS',
              version: '1.3.0',
              url: 'https://ows.terrestris.de/osm-gray/service',
              layersParam: 'OSM-WMS',
              title: 'OpenStreetMap',
              attribution:
                '© Map data from <a href="openstreetmap.org/copyright">OpenStreetMap</a>. Service provided by <a href="https://www.terrestris.de">terrestris GmbH & Co. KG</a>',
            },
          ],
        }).configure({ key: VizType.Cartodiagram }),
        ...experimentalPlugins,
      ],
    });
  }
}
