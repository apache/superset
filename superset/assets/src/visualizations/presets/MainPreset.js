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
import { Preset } from '@superset-ui/core';
import { BigNumberChartPlugin, BigNumberTotalChartPlugin } from '@superset-ui/legacy-preset-chart-big-number';
import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';
import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';
import CountryMapChartPlugin from '@superset-ui/legacy-plugin-chart-country-map';
import EventFlowChartPlugin from '@superset-ui/legacy-plugin-chart-event-flow';
import ForceDirectedChartPlugin from '@superset-ui/legacy-plugin-chart-force-directed';
import HeatmapChartPlugin from '@superset-ui/legacy-plugin-chart-heatmap';
import HistogramChartPlugin from '@superset-ui/legacy-plugin-chart-histogram';
import HorizonChartPlugin from '@superset-ui/legacy-plugin-chart-horizon';
import IframeChartPlugin from '@superset-ui/legacy-plugin-chart-iframe';
import MapBoxChartPlugin from '@superset-ui/legacy-plugin-chart-map-box';
import MarkupChartPlugin from '@superset-ui/legacy-plugin-chart-markup';
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';
import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';
import PartitionChartPlugin from '@superset-ui/legacy-plugin-chart-partition';
import PivotTableChartPlugin from '@superset-ui/legacy-plugin-chart-pivot-table';
import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';
import SankeyChartPlugin from '@superset-ui/legacy-plugin-chart-sankey';
import SunburstChartPlugin from '@superset-ui/legacy-plugin-chart-sunburst';
import TableChartPlugin from '@superset-ui/legacy-plugin-chart-table';
import TreemapChartPlugin from '@superset-ui/legacy-plugin-chart-treemap';
import WordCloudChartPlugin from '@superset-ui/legacy-plugin-chart-word-cloud';
import WorldMapChartPlugin from '@superset-ui/legacy-plugin-chart-world-map';
// There is a known issue with bubble chart that the bubbles will not show up.
// (<path d="NaN" />)
// Make sure to import '@superset-ui/legacy-preset-chart-nvd3/lib'
// Not '@superset-ui/legacy-preset-chart-nvd3',
// which will point to '@superset-ui/legacy-preset-chart-nvd3/esm' by default
import { AreaChartPlugin, BarChartPlugin, BubbleChartPlugin, BulletChartPlugin,
  CompareChartPlugin, DistBarChartPlugin, DualLineChartPlugin, LineChartPlugin,
  LineMultiChartPlugin, PieChartPlugin, TimePivotChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3/lib';
import { BoxPlotChartPlugin } from '@superset-ui/preset-chart-xy/esm/legacy';

import DeckGLChartPreset from './DeckGLChartPreset';

import FilterBoxChartPlugin from '../FilterBox/FilterBoxChartPlugin';
import TimeTableChartPlugin from '../TimeTable/TimeTableChartPlugin';

export default class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      presets: [
        new DeckGLChartPreset(),
      ],
      plugins: [
        new AreaChartPlugin().configure({ key: 'area' }),
        new BarChartPlugin().configure({ key: 'bar' }),
        new BigNumberChartPlugin().configure({ key: 'big_number' }),
        new BigNumberTotalChartPlugin().configure({ key: 'big_number_total' }),
        new BoxPlotChartPlugin().configure({ key: 'box_plot' }),
        new BubbleChartPlugin().configure({ key: 'bubble' }),
        new BulletChartPlugin().configure({ key: 'bullet' }),
        new CalendarChartPlugin().configure({ key: 'cal_heatmap' }),
        new ChordChartPlugin().configure({ key: 'chord' }),
        new CompareChartPlugin().configure({ key: 'compare' }),
        new CountryMapChartPlugin().configure({ key: 'country_map' }),
        new DistBarChartPlugin().configure({ key: 'dist_bar' }),
        new DualLineChartPlugin().configure({ key: 'dual_line' }),
        new EventFlowChartPlugin().configure({ key: 'event_flow' }),
        new FilterBoxChartPlugin().configure({ key: 'filter_box' }),
        new ForceDirectedChartPlugin().configure({ key: 'directed_force' }),
        new HeatmapChartPlugin().configure({ key: 'heatmap' }),
        new HistogramChartPlugin().configure({ key: 'histogram' }),
        new HorizonChartPlugin().configure({ key: 'horizon' }),
        new IframeChartPlugin().configure({ key: 'iframe' }),
        new LineChartPlugin().configure({ key: 'line' }),
        new LineMultiChartPlugin().configure({ key: 'line_multi' }),
        new MapBoxChartPlugin().configure({ key: 'mapbox' }),
        new MarkupChartPlugin().configure({ key: 'markup' }),
        new MarkupChartPlugin().configure({ key: 'separator' }),
        new PairedTTestChartPlugin().configure({ key: 'paired_ttest' }),
        new ParallelCoordinatesChartPlugin().configure({ key: 'para' }),
        new PartitionChartPlugin().configure({ key: 'partition' }),
        new PieChartPlugin().configure({ key: 'pie' }),
        new PivotTableChartPlugin().configure({ key: 'pivot_table' }),
        new RoseChartPlugin().configure({ key: 'rose' }),
        new SankeyChartPlugin().configure({ key: 'sankey' }),
        new SunburstChartPlugin().configure({ key: 'sunburst' }),
        new TableChartPlugin().configure({ key: 'table' }),
        new TimePivotChartPlugin().configure({ key: 'time_pivot' }),
        new TimeTableChartPlugin().configure({ key: 'time_table' }),
        new TreemapChartPlugin().configure({ key: 'treemap' }),
        new WordCloudChartPlugin().configure({ key: 'word_cloud' }),
        new WorldMapChartPlugin().configure({ key: 'world_map' }),
      ],
    });
  }
}
