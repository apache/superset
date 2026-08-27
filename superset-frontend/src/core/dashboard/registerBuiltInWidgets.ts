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
import { DASHBOARD_WIDGETS_LOCATION } from './resolveWidgetView';
import { registerContainerType } from './DashboardProvider';
import MarkdownWidget from './widgets/MarkdownWidget';
import ChartWidget from './widgets/ChartWidget';
import AgGridTableWidget from './widgets/AgGridTableWidget';
import MetricTileWidget from './widgets/MetricTileWidget';
import BalloonsWidget from './widgets/BalloonsWidget';
import TabsWidget, { TAB_TYPE } from './widgets/TabsWidget';
import CollapsibleWidget from './widgets/CollapsibleWidget';
import CarouselWidget, { SLIDE_TYPE } from './widgets/CarouselWidget';
import FilterSelectWidget from './widgets/FilterSelectWidget';
import FilterBarWidget from './widgets/FilterBarWidget';

let registered = false;

/**
 * Registers the built-in widget types through the exact same `views` call an
 * extension uses to contribute one of its own — markdown/echarts/
 * ag-grid-table/metric-tile/tabs have no special status in the render path
 * (see `WidgetView`), they're just pre-registered here before
 * anything else has a chance to render a dashboard node.
 *
 * `grid` — the root's own type — is deliberately not among them. The root
 * is not a Widget (see the composition/layout design doc): nothing
 * ever places one, and `WidgetView` resolves the root's renderer
 * directly rather than through this registry (the same reason `tab`, below,
 * isn't registered either — see `TabsWidget`).
 */
export function registerBuiltInWidgets(): void {
  if (registered) return;
  registered = true;

  views.registerView(
    {
      id: 'markdown',
      name: 'Markdown',
      description: 'Renders Markdown content.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    MarkdownWidget,
  );
  views.registerView(
    {
      id: 'echarts',
      name: 'ECharts',
      description: 'Renders a chart from an ECharts option object.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    ChartWidget,
  );
  views.registerView(
    {
      id: 'ag-grid-table',
      name: 'Table',
      description: 'Renders query results as an AG Grid table.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    AgGridTableWidget,
  );
  views.registerView(
    {
      id: 'metric-tile',
      name: 'Metric Tile',
      description: 'Renders a single live metric value as a "big number".',
    },
    DASHBOARD_WIDGETS_LOCATION,
    MetricTileWidget,
  );
  views.registerView(
    {
      id: 'balloons',
      name: 'Balloons',
      description:
        'Bouncing colored balls, one per query row (Chart Framework v2 POC). ' +
        'Schema-driven controls served from the backend.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    BalloonsWidget,
  );
  views.registerView(
    {
      id: 'filter.select',
      name: 'Filter',
      description: 'A value/multi-select dashboard filter.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    FilterSelectWidget,
  );
  views.registerView(
    {
      id: 'filter.bar',
      name: 'Filter Bar',
      description: 'A plain arranging container for filter.* children.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    FilterBarWidget,
  );
  views.registerView(
    {
      id: 'tabs',
      name: 'Tabs',
      description: 'Groups widgets into switchable tabs.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    TabsWidget,
  );
  views.registerView(
    {
      id: 'collapsible',
      name: 'Collapsible',
      description: 'Holds a single widget behind a show/hide toggle.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    CollapsibleWidget,
  );
  views.registerView(
    {
      id: 'carousel',
      name: 'Carousel',
      description:
        'Groups widgets into slides, navigated vertically one at a time.',
    },
    DASHBOARD_WIDGETS_LOCATION,
    CarouselWidget,
  );

  // A tab pane / carousel slide holds its own children (in flow — see
  // `TabsWidget`/`CarouselWidget`), but neither is registered as a view:
  // nothing ever resolves one through `resolveWidgetView` — each
  // renders its pane's/slide's children directly rather than rendering the
  // node itself. They only need to be recognized container types so
  // `addWidget` gives them a `children` array. `collapsible` needs no
  // such private type: its one child is held directly, with no intermediate
  // pane (see `CollapsibleWidget`).
  registerContainerType('tabs');
  registerContainerType(TAB_TYPE);
  registerContainerType('collapsible');
  registerContainerType('carousel');
  registerContainerType(SLIDE_TYPE);

  // filter.bar is a real container (its filter.* children are ordinary
  // nodes, added/removed/reordered like any other container's — see
  // FilterBarWidget), unlike the private pane/slide types above, so it's
  // also registered as a view (WidgetView renders it like any other
  // widget when placed directly).
  registerContainerType('filter.bar');
}
