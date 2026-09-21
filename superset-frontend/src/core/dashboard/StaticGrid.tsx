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
import type { ReactElement } from 'react';
import { useTheme } from '@apache-superset/core/theme';
import { useDashboardStore, useDashboardRevision } from './store';
import { resolveGridMetrics } from './layoutStyle';
import { packChildLayout } from './gridPacking';
// eslint-disable-next-line import/no-cycle
import WidgetView from './WidgetView';

/**
 * Read-only counterpart to `RootGrid`: the same packing (so a viewer sees the
 * layout the author arranged), laid out with CSS grid instead of gridstack.
 */
export default function StaticGrid({
  nodeId,
}: {
  nodeId: string;
}): ReactElement | null {
  const store = useDashboardStore();
  useDashboardRevision(store);
  const theme = useTheme();
  const node = store.getNode(nodeId);
  if (!node) return null;

  const children = node.children ?? [];
  const metrics = resolveGridMetrics(node.layout, theme);
  const packed = packChildLayout(children, metrics.columns, store.getNode);

  return (
    <div
      data-test="static-grid"
      data-container-id={nodeId}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${metrics.columns}, minmax(0, 1fr))`,
        gridAutoRows: metrics.rowUnitPx,
        gap: metrics.gap,
        width: '100%',
      }}
    >
      {children.map(childId => {
        const rect = packed[childId];
        if (!rect) return null;
        return (
          <WidgetView
            key={childId}
            nodeId={childId}
            style={{
              gridColumn: `${rect.x + 1} / span ${rect.w}`,
              gridRow: `${rect.y + 1} / span ${rect.h}`,
              width: '100%',
              height: '100%',
              minWidth: 0,
            }}
          />
        );
      })}
    </div>
  );
}
