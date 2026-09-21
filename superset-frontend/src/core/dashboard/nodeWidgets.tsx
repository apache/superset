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
import type { ComponentType } from 'react';
import { WidgetBusContext } from '@apache-superset/widgets/bus';
import {
  WidgetDataClientContext,
  sessionDataClient,
} from '@apache-superset/widgets/dataClient';
import { WidgetApplySourceContext } from '@apache-superset/widgets/deferredApply';
import { getWidgetComponent } from '@apache-superset/widgets/registry';
import { useDashboardRevision, useDashboardStore } from './store';

const EMPTY_PROPS: Record<string, unknown> = {};

/**
 * Renders the package's widget for `type` from a dashboard node: the node's
 * id is the widget's bus identity, the dashboard store is the bus, and data
 * goes through the author's session.
 */
export function createNodeWidget(
  type: string,
): ComponentType<{ nodeId: string }> {
  function NodeWidget({ nodeId }: { nodeId: string }) {
    const store = useDashboardStore();
    useDashboardRevision(store);
    const node = store.getNode(nodeId);
    const WidgetComponent = getWidgetComponent(type);
    if (!node || !WidgetComponent) return null;

    const parentId = store.getParentId(nodeId);
    const applySourceId =
      parentId !== undefined && store.getNode(parentId)?.type === 'filter.bar'
        ? parentId
        : undefined;

    return (
      <WidgetBusContext.Provider value={store}>
        <WidgetDataClientContext.Provider value={sessionDataClient}>
          <WidgetApplySourceContext.Provider value={applySourceId}>
            <WidgetComponent
              instanceId={nodeId}
              props={node.props ?? EMPTY_PROPS}
            />
          </WidgetApplySourceContext.Provider>
        </WidgetDataClientContext.Provider>
      </WidgetBusContext.Provider>
    );
  }
  NodeWidget.displayName = `NodeWidget(${type})`;
  return NodeWidget;
}

export const ChartNodeWidget = createNodeWidget('echarts');
export const MetricTileNodeWidget = createNodeWidget('metric-tile');
export const AgGridTableNodeWidget = createNodeWidget('ag-grid-table');
export const FilterSelectNodeWidget = createNodeWidget('filter.select');
export const MarkdownNodeWidget = createNodeWidget('markdown');
