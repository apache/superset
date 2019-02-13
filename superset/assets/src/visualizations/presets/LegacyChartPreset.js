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
import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';
import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';
import EventFlowChartPlugin from '@superset-ui/legacy-plugin-chart-event-flow';
import ForceDirectedChartPlugin from '@superset-ui/legacy-plugin-chart-force-directed';
import HeatmapChartPlugin from '@superset-ui/legacy-plugin-chart-heatmap';
import HorizonChartPlugin from '@superset-ui/legacy-plugin-chart-horizon';
import IframeChartPlugin from '@superset-ui/legacy-plugin-chart-iframe';
import MarkupChartPlugin from '@superset-ui/legacy-plugin-chart-markup';
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';
import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';
import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';
import SankeyChartPlugin from '@superset-ui/legacy-plugin-chart-sankey';
// There is a known issue with bubble chart that the bubbles will not show up.
// (<path d="NaN" />)
// Make sure to import '@superset-ui/legacy-preset-chart-nvd3/lib'
// Not '@superset-ui/legacy-preset-chart-nvd3',
// which will point to '@superset-ui/legacy-preset-chart-nvd3/esm' by default
import { BulletChartPlugin, CompareChartPlugin, DualLineChartPlugin, LineMultiChartPlugin, TimePivotChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3/lib';

import CommonChartPreset from './CommonChartPreset';
import DeckGLChartPreset from './DeckGLChartPreset';
import HierarchyChartPreset from './HierarchyChartPreset';
import MapChartPreset from './MapChartPreset';

export default class LegacyChartPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      presets: [
        new CommonChartPreset(),
        new DeckGLChartPreset(),
        new HierarchyChartPreset(),
        new MapChartPreset(),
      ],
      plugins: [
        new BulletChartPlugin().configure({ key: 'bullet' }),
        new CalendarChartPlugin().configure({ key: 'cal_heatmap' }),
        new ChordChartPlugin().configure({ key: 'chord' }),
        new CompareChartPlugin().configure({ key: 'compare' }),
        new DualLineChartPlugin().configure({ key: 'dual_line' }),
        new EventFlowChartPlugin().configure({ key: 'event_flow' }),
        new ForceDirectedChartPlugin().configure({ key: 'directed_force' }),
        new HeatmapChartPlugin().configure({ key: 'heatmap' }),
        new HorizonChartPlugin().configure({ key: 'horizon' }),
        new IframeChartPlugin().configure({ key: 'iframe' }),
        new LineMultiChartPlugin().configure({ key: 'line_multi' }),
        new MarkupChartPlugin().configure({ key: 'markup' }),
        new MarkupChartPlugin().configure({ key: 'separator' }),
        new PairedTTestChartPlugin().configure({ key: 'paired_ttest' }),
        new ParallelCoordinatesChartPlugin().configure({ key: 'para' }),
        new RoseChartPlugin().configure({ key: 'rose' }),
        new SankeyChartPlugin().configure({ key: 'sankey' }),
        new TimePivotChartPlugin().configure({ key: 'time_pivot' }),
      ],
    });
  }
}
