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
import type { DragEvent as ReactDragEvent } from 'react';
// The v1-compatible flat-props API (this component's own model: a plain
// `cols`/`rowHeight`/`margin` grid, no responsive breakpoints — see the
// design doc's "Explicitly deferred" section) lives at this subpath in v2;
// the package's main entry exports only the newer composable API.
import GridLayoutLegacy, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { provider, useDashboardRevision } from './store';
import { resolveGridMetrics } from './layoutStyle';
import { availableDropSpan, packChildLayout } from './gridPacking';
import { FALLBACK_ROW_SPAN, PALETTE_MIME, placeBlock, placeBlockAt } from './placement';
import BuildingBlockView from './BuildingBlockView';

type LayoutProps = dashboardApi.LayoutProps;

const ResizableGridLayout = WidthProvider(GridLayoutLegacy);

/** `react-grid-layout`'s own item id for the live drop preview — see `handleDropDragOver`. Distinct from `DashboardProvider`'s own `node_<n>` ids by construction, so it can never collide with a real node while a drag is in progress. */
const DROPPING_ITEM_ID = '__dropping-block__';

/**
 * Where a dragged or (via `isDroppable`, below) freshly dropped block is
 * about to land — the one on-screen answer to "where, exactly" for a
 * gesture that otherwise only shows the cursor.
 *
 * `react-grid-layout/css/styles.css` (imported above) styles its
 * `.react-grid-placeholder` red at 0.2 opacity by default — a rectangle this
 * restyles in the app's own primary colour instead, rather than editing the
 * package's own stylesheet (not this codebase's to change, and gone on the
 * next install). A descendant selector under this element's own generated
 * class outweighs the plain two-class rule it is overriding, so this wins
 * without needing `!important`.
 *
 * `react-grid-layout` renders the identical placeholder for a *resize* too,
 * carrying its own extra `placeholder-resizing` class — resizing an
 * existing block already shows that block's own edges moving live under the
 * pointer, so a second box drawn on top of it would only repeat what is
 * already on screen. The extra class is what tells the two apart; the base
 * rule is left for the drag/drop case this was actually added for.
 */
const GridSurface = styled.div`
  ${({ theme }) => css`
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;

    .react-grid-item.react-grid-placeholder {
      background-color: ${theme.colorPrimaryBg};
      border: 2px dashed ${theme.colorPrimary};
      border-radius: ${theme.borderRadiusLG}px;
      opacity: 1;

      &.placeholder-resizing {
        background: transparent;
        border: none;
        opacity: 0;
      }
    }
  `}
`;

// DEBUG INSTRUMENTATION — kept in place on purpose while the drag/resize
// interaction is still being worked out; remove only when explicitly asked
// to. Logs which node id/type a gesture actually started on (so it's
// obvious, e.g., when a click lands on a nested container instead of the
// chart the user meant to grab) and what RootGrid ends up committing at the end
// of it.
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
 * be, or contain, a container, and a drop "onto itself" isn't a valid
 * reparent target. Every container's outer element carries
 * `data-container-id` (this component's own does; others set it on whatever
 * DOM they render a drop target from), so this is the one piece of
 * cross-container awareness a drag needs: which container the pointer is
 * over right now, at any nesting depth, without any container needing to
 * know about any other container's existence.
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
 * The dashboard's own grid — not a Building Block (see the composition/
 * layout design doc), which is why it lives here rather than in `blocks/`
 * alongside the things that get placed on it. There is exactly one of these
 * per dashboard, rendered for the root and only the root: `BuildingBlockView`
 * resolves the root's renderer to this component directly, rather than
 * through the `dashboard.buildingBlocks` registry every real building block
 * goes through — nothing places a `RootGrid`, and nothing ever will, the same
 * way nothing places the dashboard itself.
 *
 * Backed by `react-grid-layout`. All position/size math — including
 * collision handling — is `react-grid-layout`'s: resizing a block never
 * shrinks a sibling, only displaces it to the next open slot (clamped to
 * `minW`/`minH: 1`), which leaves every block's own authored (hand- or
 * AI-set) span untouched. This component's job is translating between the
 * stored `col`/`row`/`colSpan`/`rowSpan` schema (which allows a child to
 * omit its position entirely, to be auto-placed) and `react-grid-layout`'s
 * own `{x, y, w, h}` — see `packChildLayout` for the auto-placement piece RGL
 * has no concept of — and committing back to the store only once a gesture
 * ends (`onDragStop`/`onResizeStop`), never on every intermediate frame.
 *
 * Dragging a block into a *different* container (reparenting, as opposed to
 * repositioning within this one) is handled by hit-testing which
 * `data-container-id` is under the pointer when the drag ends — deliberately
 * not something `react-grid-layout` (scoped to one grid instance) handles on
 * its own.
 */
export default function RootGrid({ nodeId }: { nodeId: string }) {
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

  /**
   * How wide a block being dragged in from the palette should preview at,
   * for wherever the pointer currently is — react-grid-layout's own
   * `isDroppable` calls this on every dragover and merges the `w`/`h` it
   * returns into the live placeholder, so this is the one place that decides
   * "how much room is actually here" rather than the block always claiming
   * a fixed span regardless of what it is being dropped next to.
   *
   * Not a palette drag at all (a file from the desktop, dragged text, …) is
   * `false`: nothing else on the grid should react to it, and returning
   * anything else would show a preview for a drop this grid never accepts
   * in the first place.
   *
   * Hovering over a *nested* container (a `tabs`/`collapsible`/`carousel`
   * block sitting on this grid, or anything a third party contributes) is
   * `false` for the identical reason: that container has its own drop
   * target (`FlowContent`/`EmptyArea`, tagged `data-container-id`, the same
   * way this component's own `GridSurface` is) and is where the block
   * actually belongs, not beside or on top of the container's own card on
   * *this* grid. Without this, both react to the same hover — this preview
   * showing a push-down where the container sits, the container's own
   * unaware that anything is above it — and only one of them ever runs its
   * cleanup on drop (`FlowContent`'s own `onDrop` stops the event there),
   * leaving this one's placeholder on screen with nothing left to clear it.
   *
   * The width and height themselves are `availableDropSpan`'s own call (see
   * `gridPacking.ts`) — this only has to translate the cursor's pixel
   * position into the grid cell underneath it, the same conversion
   * `react-grid-layout` itself does internally to place every other item. A
   * gap between two existing blocks that is already tall enough on its own
   * is exactly where that matters: without shrinking to fit it, the preview
   * would keep asking for its own full, unshrunk height regardless of how
   * little of it the gap actually has room for, and collide its way into
   * shoving the block below down to clear space that was never short to
   * begin with.
   *
   * `dragOffsetX`/`dragOffsetY` correct for something react-grid-layout does
   * on its own that reads wrong for this gesture: left uncorrected, it
   * centers the preview *on* the cursor, so a block six rows tall starts
   * three rows above wherever the pointer actually is. Dropped "just below"
   * a row of blocks, that is enough to land back on top of them instead —
   * exactly what this offsets away, by feeding back half of whatever pixel
   * size the preview is about to be (`react-grid-layout`'s own
   * `calcGridItemWHPx` math, reproduced here since nothing shorter reaches
   * it) so the centering it does and the anchoring this undoes cancel out,
   * and the preview's top-left corner ends up *at* the cursor instead.
   */
  const handleDropDragOver = (
    event: ReactDragEvent<HTMLDivElement>,
  ): {
    w?: number;
    h?: number;
    dragOffsetX?: number;
    dragOffsetY?: number;
  } | false => {
    if (!event.dataTransfer.types.includes(PALETTE_MIME)) {
      return false;
    }

    const hoveredContainerId = (
      event.target as HTMLElement
    ).closest<HTMLElement>('[data-container-id]')?.dataset.containerId;
    if (hoveredContainerId && hoveredContainerId !== nodeId) {
      return false;
    }

    const gridRect = event.currentTarget.getBoundingClientRect();
    const colWidth = (gridRect.width - gap * (columns - 1)) / columns;
    const colStride = colWidth + gap;
    const rowStride = rowUnitPx + gap;
    const cursorCol = Math.min(
      columns - 1,
      Math.max(0, Math.floor((event.clientX - gridRect.left) / colStride)),
    );
    const cursorRow = Math.max(
      0,
      Math.floor((event.clientY - gridRect.top) / rowStride),
    );

    const { w, h } = availableDropSpan(
      packed,
      columns,
      cursorCol,
      cursorRow,
      FALLBACK_ROW_SPAN,
    );
    const pixelWidth = Math.round(colWidth * w + Math.max(0, w - 1) * gap);
    const pixelHeight = Math.round(
      rowUnitPx * h + Math.max(0, h - 1) * gap,
    );

    return {
      w,
      h,
      dragOffsetX: pixelWidth / 2,
      dragOffsetY: pixelHeight / 2,
    };
  };

  /**
   * Where a palette drag actually lands, once released — the counterpart to
   * `GridSurface`'s own plain `onDrop` (below, for a drop that missed the
   * grid entirely, into the leftover space past its last row): this one
   * fires when react-grid-layout's own `isDroppable` resolved a real x/y/w/h
   * for the drop, live, during the drag itself (see `handleDropDragOver`),
   * so there is no position left to compute here — only a type to read off
   * the browser's own drag data, and where among the existing children this
   * new one's own row/col actually falls (see `placeBlockAt`'s own doc
   * comment for why that has to be figured out here rather than left to
   * default to "at the end").
   */
  const handleExternalDrop = (
    _rglLayout: Layout,
    item: LayoutItem | undefined,
    event: Event,
  ) => {
    const type = (event as DragEvent).dataTransfer?.getData(PALETTE_MIME);
    if (!type || !item) return;

    const readingOrderIndex = children.findIndex(id => {
      const rect = packed[id];
      return rect.y > item.y || (rect.y === item.y && rect.x >= item.x);
    });
    const index =
      readingOrderIndex === -1 ? children.length : readingOrderIndex;

    debugLog('dropOnGrid', { containerId: nodeId, type, item, index });
    placeBlockAt(nodeId, type, index, {
      col: item.x + 1,
      row: item.y + 1,
      colSpan: item.w,
      rowSpan: item.h,
    });
  };

  return (
    <GridSurface
      data-container-id={nodeId}
      data-test="grid-container"
      // The grid itself (`ResizableGridLayout`, below) now answers a drop
      // anywhere over its own rendered rows via `isDroppable` — this pair
      // only still fires for the leftover space past its last row (the
      // grid is exactly as tall as its content, and this element is not),
      // where appending full-width at the end is still the right answer,
      // the same one it always was.
      //
      // Every container is a drop target, not just the root: a nested
      // section is exactly where an author means to put something when they
      // drag it there, and the stop (in `onDrop`, below) is what makes the
      // innermost container under the pointer the one that takes it rather
      // than every ancestor claiming the same drop.
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
    >
      <ResizableGridLayout
        layout={layout}
        cols={columns}
        // Left to its own `autoSize`, this element is only ever as tall as
        // its own rows — meaning dropping "below" sparse content means
        // finding the few remaining pixels this element actually renders
        // across, past which there's no element left to fire a dragover on
        // at all (`GridSurface`'s own plain fallback, below, takes over
        // there instead — no live preview, an append at the end). A CSS
        // floor is deliberately as far as this goes: it changes nothing
        // about `layout` or what `isDroppable` tracks internally, only how
        // tall the element hovered over already is.
        //
        // A live drop preview can still push the *content* height briefly
        // past what this floor alone guarantees (the synthetic dropping
        // item can land below everything currently on screen), and this
        // element's own width is measured (by `WidthProvider`) on a
        // `ResizeObserver` callback, not synchronously — so for a frame or
        // two after that height change forces `GridSurface` to grow a
        // vertical scrollbar, this element can still think it has the width
        // from before that scrollbar took some of it back, and render
        // wider than the space actually left. `GridSurface`'s own
        // `overflow-x: hidden` (below) is what keeps that transient
        // mismatch from ever showing up as a horizontal scrollbar rather
        // than trying to keep the two measurements in perfect lockstep.
        style={{ minHeight: '100%' }}
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
        allowOverlap={false}
        preventCollision={false}
        // A palette drag is react-grid-layout's own concern from here on,
        // not `GridSurface`'s: `isDroppable` is what makes it track the drag
        // live and shows the preview `GridSurface`'s own CSS now styles
        // (see that component's doc comment), with `handleDropDragOver`
        // answering "how wide, here" on every frame and `handleExternalDrop`
        // reading the result back out once the drag actually ends.
        // `droppingItem` is only the shape's starting point — its `i` is
        // never a real node, and its `w`/`h` are overwritten by
        // `handleDropDragOver` before the preview is ever drawn — but
        // react-grid-layout still wants one up front to size the very first
        // frame against.
        isDroppable
        droppingItem={{
          i: DROPPING_ITEM_ID,
          x: 0,
          y: 0,
          w: columns,
          h: FALLBACK_ROW_SPAN,
        }}
        onDropDragOver={handleDropDragOver}
        onDrop={handleExternalDrop}
        // All four corners. The top-right one used to sit under the remove
        // control — react-grid-layout appends its handles after the block's
        // own content, so a 20px handle sat over that button and took every
        // click aimed at it. The single card-wide inset (see
        // `BuildingBlockView`) moved the button further from the true
        // corner than it sat before, which is what makes room for both here.
        resizeHandles={['se', 'sw', 'nw', 'ne']}
        // This is the only grid a dashboard has (see this component's own
        // doc comment) — a nested container never renders another `RootGrid` —
        // but a nested container (e.g. a `tabs` block) still renders its own
        // `[data-container-id]` drop target, and a click anywhere inside one
        // of those (on a leaf grandchild, or on the empty space between them)
        // must never start dragging it as a single item here, or "drag one
        // chart out of a tab" and "the whole tabs block comes with it"
        // become indistinguishable at the DOM level. A leaf child
        // (chart/markdown) never renders `data-container-id` itself, so this
        // never affects dragging a leaf.
        //
        // `[data-block-resize]` is the same guard for a different gesture —
        // `TabsBlock`'s own resize handle on a block flowed into a pane
        // (see `FlowItem`). Without it, resizing that block and dragging the
        // `tabs` item that holds it are indistinguishable for the same
        // reason: both start with a pointer-down somewhere inside this grid
        // item, and this component has no way to tell them apart except by
        // where, exactly, that press landed.
        //
        // `[data-block-header-control]` is the same guard again for a
        // type's own extra header control (see `blockHeaderControl`) — a
        // press on `collapsible`'s expand/collapse toggle must toggle it,
        // not start dragging the block it sits on.
        draggableCancel="[data-container-id],[data-block-remove],[data-block-resize],[data-block-header-control]"
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
      >
        {children.map(childId => (
          <BuildingBlockView key={childId} nodeId={childId} />
        ))}
      </ResizableGridLayout>
    </GridSurface>
  );
}
