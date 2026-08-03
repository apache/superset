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
import CanvasBlock from './blocks/CanvasBlock';
import MarkdownBlock from './blocks/MarkdownBlock';
import ChartBlock from './blocks/ChartBlock';
import AgGridTableBlock from './blocks/AgGridTableBlock';
import MetricTileBlock from './blocks/MetricTileBlock';

let registered = false;

/**
 * Registers the built-in block types through the exact same `views` call an
 * extension uses to contribute one of its own — canvas/markdown/echarts/
 * ag-grid-table/metric-tile have no special status in the render path (see
 * `BuildingBlockView`), they're just pre-registered here before anything
 * else has a chance to render a dashboard node.
 */
export function registerBuiltInBuildingBlocks(): void {
  if (registered) return;
  registered = true;

  views.registerView(
    {
      id: 'canvas',
      name: 'Canvas',
      description: 'A flex container for other building blocks.',
    },
    DASHBOARD_BUILDING_BLOCKS_LOCATION,
    CanvasBlock,
  );
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
}
