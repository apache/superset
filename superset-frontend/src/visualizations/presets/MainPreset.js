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
import {
  BigNumberChartPlugin,
  BigNumberTotalChartPlugin,
} from '@superset-ui/legacy-preset-chart-big-number';

// There is a known issue with bubble chart that the bubbles will not show up.
// (<path d="NaN" />)
// Make sure to import '@superset-ui/legacy-preset-chart-nvd3/lib'
// Not '@superset-ui/legacy-preset-chart-nvd3',
// which will point to '@superset-ui/legacy-preset-chart-nvd3/esm' by default
import {
  AreaChartPlugin,
  BarChartPlugin,
  BubbleChartPlugin,
  BulletChartPlugin,
  CompareChartPlugin,
  DistBarChartPlugin,
  DualLineChartPlugin,
  LineChartPlugin,
  LineMultiChartPlugin,
  PieChartPlugin,
  TimePivotChartPlugin,
} from '@superset-ui/legacy-preset-chart-nvd3/lib';
import { DeckGLChartPreset } from '@superset-ui/legacy-preset-chart-deckgl';


export default class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      presets: [new DeckGLChartPreset()],
      plugins: [
        new BigNumberChartPlugin().configure({ key: 'big_number' }),
        new BigNumberTotalChartPlugin().configure({ key: 'big_number_total' }),

        // NVD3 STUFF
        new AreaChartPlugin().configure({ key: 'area' }),
        new BarChartPlugin().configure({ key: 'bar' }),
        new BubbleChartPlugin().configure({ key: 'bubble' }),
        new BulletChartPlugin().configure({ key: 'bullet' }),
        new CompareChartPlugin().configure({ key: 'compare' }),
        new DistBarChartPlugin().configure({ key: 'dist_bar' }),
        new DualLineChartPlugin().configure({ key: 'dual_line' }),
        new LineChartPlugin().configure({ key: 'line' }),
        new LineMultiChartPlugin().configure({ key: 'line_multi' }),
        new PieChartPlugin().configure({ key: 'pie' }),
        new TimePivotChartPlugin().configure({ key: 'time_pivot' }),
        // END NVD3 STUFF

        import('@superset-ui/preset-chart-xy/esm/legacy').then(module => new module.default().configure({ key: 'box_plot' })),
        import('@superset-ui/legacy-plugin-chart-calendar').then(module => new module.default().configure({ key: 'cal_heatmap' })),
        import('../FilterBox/FilterBoxChartPlugin').then(module => new module.default().configure({ key: 'filter_box' })),
        import('@superset-ui/legacy-plugin-chart-chord').then(module => new module.default().configure({ key: 'chord' })),
        import('@superset-ui/legacy-plugin-chart-country-map').then(module => new module.default().configure({ key: 'country_map' })),
        import('@superset-ui/legacy-plugin-chart-event-flow').then(module => new module.default().configure({ key: 'event_flow' })),
        import('@superset-ui/legacy-plugin-chart-force-directed').then(module => new module.default().configure({ key: 'directed_force' })),
        import('@superset-ui/legacy-plugin-chart-heatmap').then(module => new module.default().configure({ key: 'heatmap' })),
        import('@superset-ui/legacy-plugin-chart-histogram').then(module => new module.default().configure({ key: 'histogram' })),
        import('@superset-ui/legacy-plugin-chart-horizon').then(module => new module.default().configure({ key: 'horizon' })),
        import('@superset-ui/legacy-plugin-chart-iframe').then(module => new module.default().configure({ key: 'iframe' })),
        import('@superset-ui/legacy-plugin-chart-map-box').then(module => new module.default().configure({ key: 'mapbox' })),
        import('@superset-ui/legacy-plugin-chart-markup').then(module => new module.default().configure({ key: 'separator' })),
        import('@superset-ui/legacy-plugin-chart-paired-t-test').then(module => new module.default().configure({ key: 'paired_ttest' })),
        import('@superset-ui/legacy-plugin-chart-parallel-coordinates').then(module => new module.default().configure({ key: 'para' })),
        import('@superset-ui/legacy-plugin-chart-partition').then(module => new module.default().configure({ key: 'partition' })),
        import('@superset-ui/legacy-plugin-chart-pivot-table').then(module => new module.default().configure({ key: 'pivot_table' })),
        import('@superset-ui/legacy-plugin-chart-rose').then(module => new module.default().configure({ key: 'rose' })),
        import('@superset-ui/legacy-plugin-chart-sankey').then(module => new module.default().configure({ key: 'sankey' })),
        import('@superset-ui/legacy-plugin-chart-sunburst').then(module => new module.default().configure({ key: 'sunburst' })),
        import('@superset-ui/legacy-plugin-chart-table').then(module => new module.default().configure({ key: 'table' })),
        import('../TimeTable/TimeTableChartPlugin').then(module => new module.default().configure({ key: 'time_table' })),
        // import('../../../../../superset-ui-plugins_preset/packages/superset-ui-legacy-plugin-chart-treemap/src').then(module => new module.default().configure({ key: 'treemap' })),
        import('@superset-ui/legacy-plugin-chart-treemap').then(module => new module.default().configure({ key: 'treemap' })),
        // import('../../../../../superset-ui-plugins_preset/packages/superset-ui-legacy-plugin-chart-word-cloud').then(module => new module.default().configure({ key: 'word_cloud' })),
        import('@superset-ui/legacy-plugin-chart-word-cloud').then(module => new module.default().configure({ key: 'word_cloud' })),
        import('@superset-ui/legacy-plugin-chart-world-map').then(module => new module.default().configure({ key: 'world_map' })),

      ],
    });
  }
}
