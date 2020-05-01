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
import { getChartControlPanelRegistry } from '@superset-ui/chart';
import MainPreset from '../visualizations/presets/MainPreset';
import setupPluginsExtra from './setupPluginsExtra';

import Area from '../explore/controlPanels/Area';
import Bar from '../explore/controlPanels/Bar';
import BoxPlot from '../explore/controlPanels/BoxPlot';
import Bubble from '../explore/controlPanels/Bubble';
import Bullet from '../explore/controlPanels/Bullet';
import CalHeatmap from '../explore/controlPanels/CalHeatmap';
import Chord from '../explore/controlPanels/Chord';
import Compare from '../explore/controlPanels/Compare';
import CountryMap from '../explore/controlPanels/CountryMap';
import DeckArc from '../explore/controlPanels/DeckArc';
import DeckGeojson from '../explore/controlPanels/DeckGeojson';
import DeckGrid from '../explore/controlPanels/DeckGrid';
import DeckHex from '../explore/controlPanels/DeckHex';
import DeckMulti from '../explore/controlPanels/DeckMulti';
import DeckPath from '../explore/controlPanels/DeckPath';
import DeckPolygon from '../explore/controlPanels/DeckPolygon';
import DeckScatter from '../explore/controlPanels/DeckScatter';
import DeckScreengrid from '../explore/controlPanels/DeckScreengrid';
import DirectedForce from '../explore/controlPanels/DirectedForce';
import DistBar from '../explore/controlPanels/DistBar';
import DualLine from '../explore/controlPanels/DualLine';
import EventFlow from '../explore/controlPanels/EventFlow';
import FilterBox from '../explore/controlPanels/FilterBox';
import Heatmap from '../explore/controlPanels/Heatmap';
import Histogram from '../explore/controlPanels/Histogram';
import Horizon from '../explore/controlPanels/Horizon';
import Iframe from '../explore/controlPanels/Iframe';
import Line from '../explore/controlPanels/Line';
import LineMulti from '../explore/controlPanels/LineMulti';
import Mapbox from '../explore/controlPanels/Mapbox';
import Markup from '../explore/controlPanels/Markup';
import PairedTtest from '../explore/controlPanels/PairedTtest';
import Para from '../explore/controlPanels/Para';
import Partition from '../explore/controlPanels/Partition';
import Pie from '../explore/controlPanels/Pie';
import PivotTable from '../explore/controlPanels/PivotTable';
import Rose from '../explore/controlPanels/Rose';
import Sankey from '../explore/controlPanels/Sankey';
import Separator from '../explore/controlPanels/Separator';
import Sunburst from '../explore/controlPanels/Sunburst';
import Table from '../explore/controlPanels/Table';
import TimePivot from '../explore/controlPanels/TimePivot';
import TimeTable from '../explore/controlPanels/TimeTable';
import Treemap from '../explore/controlPanels/Treemap';
import WordCloud from '../explore/controlPanels/WordCloud';
import WorldMap from '../explore/controlPanels/WorldMap';

export default function setupPlugins() {
  new MainPreset().register();

  // TODO: Remove these shims once the control panel configs are moved into the plugin package.
  getChartControlPanelRegistry()
    .registerValue('area', Area)
    .registerValue('bar', Bar)
    .registerValue('box_plot', BoxPlot)
    .registerValue('bubble', Bubble)
    .registerValue('bullet', Bullet)
    .registerValue('cal_heatmap', CalHeatmap)
    .registerValue('chord', Chord)
    .registerValue('compare', Compare)
    .registerValue('country_map', CountryMap)
    .registerValue('directed_force', DirectedForce)
    .registerValue('dist_bar', DistBar)
    .registerValue('dual_line', DualLine)
    .registerValue('event_flow', EventFlow)
    .registerValue('filter_box', FilterBox)
    .registerValue('heatmap', Heatmap)
    .registerValue('histogram', Histogram)
    .registerValue('horizon', Horizon)
    .registerValue('iframe', Iframe)
    .registerValue('line', Line)
    .registerValue('line_multi', LineMulti)
    .registerValue('mapbox', Mapbox)
    .registerValue('markup', Markup)
    .registerValue('paired_ttest', PairedTtest)
    .registerValue('para', Para)
    .registerValue('partition', Partition)
    .registerValue('pie', Pie)
    .registerValue('pivot_table', PivotTable)
    .registerValue('rose', Rose)
    .registerValue('sankey', Sankey)
    .registerValue('separator', Separator)
    .registerValue('sunburst', Sunburst)
    .registerValue('table', Table)
    .registerValue('time_pivot', TimePivot)
    .registerValue('time_table', TimeTable)
    .registerValue('treemap', Treemap)
    .registerValue('word_cloud', WordCloud)
    .registerValue('world_map', WorldMap)
    .registerValue('deck_arc', DeckArc)
    .registerValue('deck_geojson', DeckGeojson)
    .registerValue('deck_grid', DeckGrid)
    .registerValue('deck_hex', DeckHex)
    .registerValue('deck_multi', DeckMulti)
    .registerValue('deck_path', DeckPath)
    .registerValue('deck_polygon', DeckPolygon)
    .registerValue('deck_scatter', DeckScatter)
    .registerValue('deck_screengrid', DeckScreengrid);

  setupPluginsExtra();
}
