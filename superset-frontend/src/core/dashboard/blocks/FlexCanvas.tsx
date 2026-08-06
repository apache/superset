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
import { useCallback, useState } from 'react';
import type { DragEvent } from 'react';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { useTheme } from '@apache-superset/core/theme';
import { provider } from '../store';
import {
  DEFAULT_COLUMNS,
  resolveFlexBasis,
  resolveFlexMetrics,
} from '../layoutStyle';
import { PALETTE_MIME, placeBlock } from '../placement';
import BuildingBlockView from '../BuildingBlockView';

type LayoutProps = dashboardApi.LayoutProps;

/** Carried on a reorder drag so a drop elsewhere in the app ignores it. */
const FLEX_MIME = 'application/x-dashboard-flex-child';

/**
 * A `flex` container: children flow along a line and wrap, sharing it in
 * proportion to their `colSpan`.
 *
 * `react-grid-layout` is deliberately absent here. Every other mode is a
 * grid, and RGL's whole model is coordinates in one — a flex line has no
 * cells to give it, and asking it to lay out a wrapping proportional flow
 * would mean computing the flow ourselves and then telling RGL the answer.
 * CSS already does that, correctly, at every width.
 *
 * Which means position is order, and order is `children`. So the gesture
 * that arranges a flex container is a reorder rather than a reposition, and
 * it commits through `moveBuildingBlock` — the same call the AI tools use, so
 * dragging a block and asking for it to be moved end at the same place.
 * Without this a flex container would be a mode an author can see and not
 * author in, which is worse than not offering it.
 */
export default function FlexCanvas({
  nodeId,
  layout,
  childIds,
}: {
  nodeId: string;
  layout: LayoutProps | undefined;
  childIds: readonly string[];
}) {
  const theme = useTheme();
  const metrics = resolveFlexMetrics(layout, theme);
  const columns = layout?.columns ?? DEFAULT_COLUMNS;
  /** Which child the pointer is currently over, so the drop target is visible. */
  const [over, setOver] = useState<string | undefined>(undefined);

  const drop = useCallback(
    (event: DragEvent, targetId: string) => {
      event.preventDefault();
      setOver(undefined);
      const draggedId = event.dataTransfer.getData(FLEX_MIME);
      if (draggedId === '' || draggedId === targetId) {
        return;
      }
      const index = childIds.indexOf(targetId);
      if (index === -1) {
        return;
      }
      try {
        provider.moveBuildingBlock(draggedId, nodeId, index);
      } catch {
        // Dropped into itself or one of its own descendants. The provider
        // refuses it; leaving the tree as it was is the whole handling.
      }
    },
    [childIds, nodeId],
  );

  return (
    <div
      data-container-id={nodeId}
      data-test="flex-canvas"
      // A flex container takes a palette drop like every other container. Its
      // own children carry a different payload, so a reorder within the line
      // and a placement from the palette never read as each other.
      onDragOver={event => {
        if (event.dataTransfer.types.includes(PALETTE_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={event => {
        const type = event.dataTransfer.getData(PALETTE_MIME);
        if (type !== '') {
          event.preventDefault();
          event.stopPropagation();
          placeBlock(nodeId, type);
        }
      }}
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        alignContent: 'flex-start',
        flexDirection: metrics.flexDirection,
        flexWrap: metrics.flexWrap,
        justifyContent: metrics.justifyContent,
        alignItems: metrics.alignItems,
        gap: metrics.gap,
      }}
    >
      {childIds.map(childId => {
        const child = provider.getNode(childId);
        const basis = resolveFlexBasis(child?.layout, columns, childIds.length);
        return (
          <div
            key={childId}
            draggable
            data-test={`flex-child-${childId}`}
            onDragStart={event => {
              event.dataTransfer.setData(FLEX_MIME, childId);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={event => {
              event.preventDefault();
              setOver(childId);
            }}
            onDragLeave={() =>
              setOver(current => (current === childId ? undefined : current))
            }
            onDrop={event => drop(event, childId)}
            style={{
              // The basis is the share; growing past it would let a wide
              // sibling's leftover space silently re-widen a narrow one, so
              // what the author set is what is drawn.
              flex: `0 0 ${metrics.flexDirection === 'row' ? basis : 'auto'}`,
              // Subtracting the gap keeps two halves on one line: a basis of
              // 50% twice plus a gap between them is wider than the line.
              maxWidth:
                metrics.flexDirection === 'row'
                  ? `calc(${basis} - ${metrics.gap}px)`
                  : undefined,
              height: (child?.layout?.rowSpan ?? 1) * metrics.rowUnitPx,
              outline:
                over === childId
                  ? `2px solid ${theme.colorPrimary}`
                  : undefined,
              cursor: 'grab',
            }}
          >
            <BuildingBlockView nodeId={childId} />
          </div>
        );
      })}
    </div>
  );
}
