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
import { useCallback } from 'react';
// The v1-compatible flat-props API (this component's own model: a plain
// `cols`/`rowHeight`/`margin` grid, no responsive breakpoints — see the
// design doc's "Explicitly deferred" section) lives at this subpath in v2;
// the package's main entry exports only the newer composable API.
import GridLayoutLegacy, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { useTheme } from '@apache-superset/core/theme';
import { provider, useDashboardRevision } from '../store';
import { resolveGridMetrics } from '../layoutStyle';
import { packChildLayout } from '../gridPacking';
import BuildingBlockView from '../BuildingBlockView';

type LayoutProps = dashboardApi.LayoutProps;

const ResizableGridLayout = WidthProvider(GridLayoutLegacy);

// DEBUG INSTRUMENTATION — kept in place on purpose while the drag/resize
// interaction is still being worked out; remove only when explicitly asked
// to. Logs which node id/type a gesture actually started on (so it's
// obvious, e.g., when a click lands on a `canvas` row container instead of
// the chart the user meant to grab) and what CanvasBlock ends up committing
// at the end of it.
const DASHBOARD_DRAG_DEBUG = true;
function debugLog(event: string, detail: Record<string, unknown>) {
  if (!DASHBOARD_DRAG_DEBUG) return;
  // eslint-disable-next-line no-console
  console.debug(`[dashboard-drag] ${event}`, detail);
}
function describeNode(id: string | undefined) {
  if (!id) return undefined;
  const node = provider.getNode(id);
  return { id, type: node?.type };
}

/**
 * Finds the deepest dashboard container actually under a screen point,
 * ignoring `excludeEl`'s own subtree — the block being dragged might itself
 * be, or contain, a canvas, and a drop "onto itself" isn't a valid reparent
 * target. Every canvas's outer element carries `data-container-id`, so this
 * is the one piece of cross-container awareness a drag needs: which
 * container the pointer is over right now, at any nesting depth, without
 * any container needing to know about any other container's existence.
 *
 * `excludeEl`'s `pointer-events` is toggled off for the single synchronous
 * `elementFromPoint` call so the hit-test sees through the dragged element
 * to whatever is actually underneath it on screen (otherwise the dragged
 * element — positioned directly under the cursor by definition — would
 * always be its own top hit).
 */
function findContainerIdAt(
  clientX: number,
  clientY: number,
  excludeEl: HTMLElement,
): string | null {
  const previousPointerEvents = excludeEl.style.pointerEvents;
  excludeEl.style.pointerEvents = 'none';
  const hit = document.elementFromPoint(clientX, clientY);
  excludeEl.style.pointerEvents = previousPointerEvents;
  return (
    hit?.closest<HTMLElement>('[data-container-id]')?.dataset.containerId ??
    null
  );
}

/**
 * The built-in `canvas` building block: a grid container for child nodes,
 * backed by `react-grid-layout` — same recursive resolution its children
 * use (see `BuildingBlockView`), so nesting works identically whether a
 * child is another canvas, a leaf built-in block, or an extension's.
 *
 * All position/size math — including collision handling — is
 * `react-grid-layout`'s: resizing a block never shrinks a sibling, only
 * displaces it to the next open slot (clamped to `minW`/`minH: 1`), which
 * leaves every block's own authored (hand- or AI-set) span untouched. This
 * component's job is translating between the stored `col`/`row`/`colSpan`/
 * `rowSpan` schema (which allows a child to omit its position entirely, to
 * be auto-placed) and `react-grid-layout`'s own `{x, y, w, h}` — see
 * `packChildLayout` for the auto-placement piece RGL has no concept of — and
 * committing back to the store only once a gesture ends
 * (`onDragStop`/`onResizeStop`), never on every intermediate frame.
 *
 * Dragging a block into a *different* container (reparenting, as opposed to
 * repositioning within this one) is handled by hit-testing which
 * `data-container-id` is under the pointer when the drag ends — deliberately
 * not something `react-grid-layout` (scoped to one grid instance) handles on
 * its own.
 */
export default function CanvasBlock({ nodeId }: { nodeId: string }) {
  useDashboardRevision();
  const theme = useTheme();
  const node = provider.getNode(nodeId);

  const commitLayout = useCallback(
    (rglLayout: Layout) => {
      const updates: Record<string, Partial<LayoutProps>> = {};
      rglLayout.forEach(item => {
        updates[item.i] = {
          col: item.x + 1,
          row: item.y + 1,
          colSpan: item.w,
          rowSpan: item.h,
        };
      });
      debugLog('commitLayout', { containerId: nodeId, updates });
      provider.updateLayouts(updates);
    },
    [nodeId],
  );

  const handleDragStart = useCallback(
    (_layout: Layout, _oldItem: unknown, newItem: { i: string } | null) => {
      debugLog('dragStart', {
        containerId: nodeId,
        dragged: describeNode(newItem?.i),
      });
    },
    [nodeId],
  );

  const handleResizeStart = useCallback(
    (_layout: Layout, _oldItem: unknown, newItem: { i: string } | null) => {
      debugLog('resizeStart', {
        containerId: nodeId,
        resized: describeNode(newItem?.i),
      });
    },
    [nodeId],
  );

  const handleResizeStop = useCallback(
    (rglLayout: Layout, _oldItem: unknown, newItem: { i: string } | null) => {
      debugLog('resizeStop', {
        containerId: nodeId,
        resized: describeNode(newItem?.i),
      });
      commitLayout(rglLayout);
    },
    [nodeId, commitLayout],
  );

  const handleDragStop = useCallback(
    (
      rglLayout: Layout,
      _oldItem: unknown,
      newItem: { i: string } | null,
      _placeholder: unknown,
      event: Event,
      element: HTMLElement | null,
    ) => {
      const { clientX, clientY } = event as MouseEvent;
      const targetContainerId =
        newItem && element && clientX != null && clientY != null
          ? findContainerIdAt(clientX, clientY, element)
          : null;

      debugLog('dragStop', {
        containerId: nodeId,
        dragged: describeNode(newItem?.i),
        targetContainerId,
        reparenting: !!targetContainerId && targetContainerId !== nodeId,
      });

      if (targetContainerId && targetContainerId !== nodeId && newItem) {
        try {
          // moveBuildingBlock itself clears col/row and clamps colSpan to
          // the destination's own column count — old coordinates were only
          // ever meaningful in *this* container's grid.
          const destIndex =
            provider.getNode(targetContainerId)?.children?.length ?? 0;
          provider.moveBuildingBlock(newItem.i, targetContainerId, destIndex);
          return;
        } catch {
          // Dropped onto itself or one of its own descendants — not a valid
          // reparent target. Fall through and keep it in this container.
        }
      }

      commitLayout(rglLayout);
    },
    [nodeId, commitLayout],
  );

  if (!node) return null;

  const { columns, gap, rowUnitPx } = resolveGridMetrics(node.layout, theme);
  const children = node.children ?? [];
  const packed = packChildLayout(children, columns, provider.getNode);
  const layout: Layout = children.map(id => ({
    i: id,
    minW: 1,
    minH: 1,
    ...packed[id],
  }));

  return (
    <div
      data-container-id={nodeId}
      style={{ width: '100%', height: '100%', overflow: 'auto' }}
    >
      <ResizableGridLayout
        layout={layout}
        cols={columns}
        rowHeight={rowUnitPx}
        margin={[gap, gap] as const}
        containerPadding={[0, 0] as const}
        // Explicit rather than relying on the (identical) default, since the
        // obvious-looking alternative doesn't work: `compactType={null}`
        // (no compaction) looks like it should mean "displace only the
        // sibling actually being collided with," but react-grid-layout's
        // own collision-resolution branch for `compactType === null`
        // (`moveElementAwayFromCollision`'s "collisionNorth" case) re-adds
        // a colliding sibling's full height on *every* drag frame the
        // collision persists rather than settling once it's clear —
        // confirmed live: dragging one tile so it merely brushes a
        // neighbor's edge sent that neighbor hundreds of pixels away within
        // a few mouse-move events. `"vertical"` resolves the same collision
        // by moving the sibling down exactly once, by exactly its own
        // height, every time.
        compactType="vertical"
        preventCollision={false}
        resizeHandles={['se', 'sw', 'ne', 'nw']}
        // A nested canvas that declares its own `rowUnit` independently of
        // the outer `rowSpan` that placed it can end up needing more (or
        // less) height than that outer placement actually reserves — see
        // the `overflow: 'auto'` above, which is what keeps a too-tall
        // nested grid from bleeding into whatever comes after it instead of
        // scrolling internally. This selector is the drag-side half of the
        // same nesting concern: `[data-container-id]` matches only this
        // node's own children that are themselves a `canvas` — a click
        // anywhere inside one of those (on a leaf grandchild, or on the
        // empty space between them) must never start dragging that nested
        // canvas as a single item here, or "drag one chart in a KPI row"
        // and "the whole row comes with it" become indistinguishable at the
        // DOM level. A leaf child (chart/markdown) never renders
        // `data-container-id` itself, so this never affects dragging a
        // leaf — only a nested canvas becomes un-draggable as a whole via
        // a body click (it's still resizable via its own corner handles).
        draggableCancel="[data-container-id]"
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
      >
        {children.map(childId => (
          <BuildingBlockView key={childId} nodeId={childId} />
        ))}
      </ResizableGridLayout>
    </div>
  );
}
