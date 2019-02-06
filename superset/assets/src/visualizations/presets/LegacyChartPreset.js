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
import CommonChartPreset from './CommonChartPreset';
import DeckGLChartPreset from './DeckGLChartPreset';
import HierarchyChartPreset from './HierarchyChartPreset';
import MapChartPreset from './MapChartPreset';
import BulletChartPlugin from '../nvd3/Bullet/BulletChartPlugin';
import CalendarChartPlugin from '../Calendar/CalendarChartPlugin';
import ChordChartPlugin from '../Chord/ChordChartPlugin';
import CompareChartPlugin from '../nvd3/Compare/CompareChartPlugin';
import DualLineChartPlugin from '../nvd3/DualLine/DualLineChartPlugin';
import EventFlowChartPlugin from '../EventFlow/EventFlowChartPlugin';
import ForceDirectedChartPlugin from '../ForceDirected/ForceDirectedChartPlugin';
import HeatmapChartPlugin from '../Heatmap/HeatmapChartPlugin';
import HorizonChartPlugin from '../Horizon/HorizonChartPlugin';
import IframeChartPlugin from '../Iframe/IframeChartPlugin';
import LineMultiChartPlugin from '../nvd3/LineMulti/LineMultiChartPlugin';
import MarkupChartPlugin from '../Markup/MarkupChartPlugin';
import PairedTTestChartPlugin from '../PairedTTest/PairedTTestChartPlugin';
import ParallelCoordinatesChartPlugin from '../ParallelCoordinates/ParallelCoordinatesChartPlugin';
import RoseChartPlugin from '../Rose/RoseChartPlugin';
import SankeyChartPlugin from '../Sankey/SankeyChartPlugin';
import TimePivotChartPlugin from '../nvd3/TimePivot/TimePivotChartPlugin';

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
