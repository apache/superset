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
import { views } from 'src/core/views';
import { DASHBOARD_BUILDING_BLOCKS_LOCATION } from './resolveBuildingBlockView';
import { registerContainerType } from './DashboardProvider';
import MarkdownBlock from './blocks/MarkdownBlock';
import ChartBlock from './blocks/ChartBlock';
import AgGridTableBlock from './blocks/AgGridTableBlock';
import MetricTileBlock from './blocks/MetricTileBlock';
import TabsBlock, { TAB_TYPE } from './blocks/TabsBlock';
import CollapsibleBlock from './blocks/CollapsibleBlock';
import CarouselBlock, { SLIDE_TYPE } from './blocks/CarouselBlock';

let registered = false;

/**
 * Registers the built-in block types through the exact same `views` call an
 * extension uses to contribute one of its own — markdown/echarts/
 * ag-grid-table/metric-tile/tabs have no special status in the render path
 * (see `BuildingBlockView`), they're just pre-registered here before
 * anything else has a chance to render a dashboard node.
 *
 * `grid` — the root's own type — is deliberately not among them. The root
 * is not a Building Block (see the composition/layout design doc): nothing
 * ever places one, and `BuildingBlockView` resolves the root's renderer
 * directly rather than through this registry (the same reason `tab`, below,
 * isn't registered either — see `TabsBlock`).
 */
export function registerBuiltInBuildingBlocks(): void {
  if (registered) return;
  registered = true;

  views.registerView(
    {
      id: 'markdown',
      name: 'Markdown',
      description: 'Renders Markdown content.',
    },
    DASHBOARD_BUILDING_BLOCKS_LOCATION,
    MarkdownBlock,
  );
  views.registerView(
    {
      id: 'echarts',
      name: 'ECharts',
      description: 'Renders a chart from an ECharts option object.',
    },
    DASHBOARD_BUILDING_BLOCKS_LOCATION,
    ChartBlock,
  );
  views.registerView(
    {
      id: 'ag-grid-table',
      name: 'Table',
      description: 'Renders query results as an AG Grid table.',
    },
    DASHBOARD_BUILDING_BLOCKS_LOCATION,
    AgGridTableBlock,
  );
  views.registerView(
    {
      id: 'metric-tile',
      name: 'Metric Tile',
      description: 'Renders a single live metric value as a "big number".',
    },
    DASHBOARD_BUILDING_BLOCKS_LOCATION,
    MetricTileBlock,
  );
  views.registerView(
    {
      id: 'tabs',
      name: 'Tabs',
      description: 'Groups building blocks into switchable tabs.',
    },
    DASHBOARD_BUILDING_BLOCKS_LOCATION,
    TabsBlock,
  );
  views.registerView(
    {
      id: 'collapsible',
      name: 'Collapsible',
      description: 'Holds a single building block behind a show/hide toggle.',
    },
    DASHBOARD_BUILDING_BLOCKS_LOCATION,
    CollapsibleBlock,
  );
  views.registerView(
    {
      id: 'carousel',
      name: 'Carousel',
      description:
        'Groups building blocks into slides, navigated vertically one at a time.',
    },
    DASHBOARD_BUILDING_BLOCKS_LOCATION,
    CarouselBlock,
  );

  // A tab pane / carousel slide holds its own children (in flow — see
  // `TabsBlock`/`CarouselBlock`), but neither is registered as a view:
  // nothing ever resolves one through `resolveBuildingBlockView` — each
  // renders its pane's/slide's children directly rather than rendering the
  // node itself. They only need to be recognized container types so
  // `addBuildingBlock` gives them a `children` array. `collapsible` needs no
  // such private type: its one child is held directly, with no intermediate
  // pane (see `CollapsibleBlock`).
  registerContainerType('tabs');
  registerContainerType(TAB_TYPE);
  registerContainerType('collapsible');
  registerContainerType('carousel');
  registerContainerType(SLIDE_TYPE);
}
