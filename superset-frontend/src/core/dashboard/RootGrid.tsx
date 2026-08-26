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
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import 'gridstack/dist/gridstack.min.css';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { provider, useDashboardRevision } from './store';
import {
  cellAtPoint,
  pixelRectForCell,
  resolveCellGeometry,
  resolveGridMetrics,
} from './layoutStyle';
import { packChildLayout, resolveDropPlacement } from './gridPacking';
import type { DropPlacement, PackedRect } from './gridPacking';
import {
  FALLBACK_COL_SPAN,
  FALLBACK_ROW_SPAN,
  PALETTE_MIME,
  placeBlock,
  placeBlockAt,
} from './placement';
import { useGridStack } from './useGridStack';
import type { GestureEnd, GestureEndItem } from './useGridStack';
import WidgetView from './WidgetView';

type LayoutProps = dashboardApi.LayoutProps;

/**
 * The `draggableCancel`-equivalent guard: regions a press must never start a
 * drag from. `[data-container-id]` is a nested container (dragging one chart
 * out of a `tabs` widget must not drag the whole `tabs` widget); `[data-widget-
 * remove]` is a widget's own remove control; `[data-widget-resize]` is a flowed
 * widget's own resize grip (`flowContent.tsx`); `[data-widget-header-control]`
 * is a type's own extra header control (e.g. `collapsible`'s toggle).
 *
 * `nodeId` is threaded through and excluded from the `data-container-id`
 * clause via `:not(...)` — GridStack matches this with a plain, unbounded
 * `e.target.closest(cancel)`, which walks every ancestor all the way to
 * `document`, not just the ones between the press and the widget being
 * dragged. `GridSurface` (this very grid's own outer element, below) itself
 * carries `data-container-id={nodeId}` — the marker every *other* container
 * on the page also carries, and the one this grid's own drop-target/defer
 * checks need it to have — so without the exclusion, *every* press inside
 * this grid's own boundary matches its own ancestor marker and cancels
 * every drag unconditionally, leaving only resize (a separate code path
 * that never consults `cancel` at all) working. A different value here
 * (any other container actually nested inside the widget being dragged)
 * still matches and still cancels, exactly as intended.
 *
 * `[data-widget-menu]` is the widget header's overflow menu (see
 * `WidgetView`) — opening it must not also drag the card it sits on.
 */
function cancelSelectorFor(nodeId: string): string {
  return `[data-container-id]:not([data-container-id="${CSS.escape(nodeId)}"]),[data-widget-remove],[data-widget-resize],[data-widget-header-control],[data-widget-menu]`;
}

/**
 * The surface everything else in this file draws on — deliberately not a
 * scroll container of its own. The page's own `Canvas` (`DashboardBuilderV2`)
 * is the one authoritative scrollable region for the whole editor; `overflow`
 * is left at its default `visible` here (no `overflow-x`/`overflow-y` of its
 * own) so content taller than this element simply paints past its edge
 * instead of this element clipping or independently scrolling it — two
 * nested `overflow: auto` boxes would each try to own the same scroll
 * gesture, which reads as broken scrolling rather than as "the canvas is
 * tall, scroll it".
 *
 * `height: 100%`, deliberately not `min-height: 100%` — this has to be a
 * value CSS treats as "specified explicitly" for `GridStackContainer`'s own
 * `min-height: 100%` (below) to resolve against a definite number at all.
 * `min-height` on *this* element does not count as that, per spec (the used
 * height still "depends on content height"), so swapping this to
 * `min-height: 100%` — the seemingly-symmetric choice with the child below —
 * silently collapses the child's own floor to nothing whenever content is
 * shorter than the viewport. `overflow: visible` is what actually keeps
 * taller content from clipping here; `height` (not `min-height`) is what
 * keeps the drop target's own floor intact when content is shorter.
 *
 * `.grid-stack-item-content`'s own default CSS gives it `overflow-y: auto`
 * — undone here, since `WidgetView`'s own card already decides how
 * its content overflows (clipped, per its own `overflow: hidden`), and a
 * second, independent scroll container around it would fight that rather
 * than help it.
 */
const GridSurface = styled.div`
  width: 100%;
  height: 100%;

  .grid-stack-item-content {
    overflow: visible;
  }

  /*
   * GridStack's own resize-handle CSS draws its corner glyph at the full
   * size of its own 20px hit box (viewBox="0 0 20 20", stroke-width 2) —
   * bold enough to read as a UI element in its own right rather than the
   * small, quiet corner grip react-grid-layout drew before this migration.
   * Shrinking only the glyph (not the box itself, left alone so the actual
   * clickable/touchable corner stays exactly as forgiving as GridStack's
   * own default) keeps the affordance without it visually dominating the
   * card corner it sits on.
   */
  .grid-stack-item > .ui-resizable-handle {
    background-size: 10px 10px;
  }
`;

/**
 * The `.grid-stack` element itself — GridStack's own required class, plus a
 * CSS floor so there is always somewhere to drop "below" sparse content:
 * left to its own content-driven height, dropping past the last row would
 * mean finding the few remaining pixels this element actually renders
 * across, past which there's no element left to fire a dragover on at all
 * (`GridSurface`'s own plain fallback, below, takes over there instead — no
 * live preview, an append at the end).
 */
const GridStackContainer = styled.div`
  min-height: 100%;
`;

/**
 * The live drop preview — not GridStack's own placeholder (this grid never
 * hands GridStack the palette drag at all; see `useGridStack`'s own doc
 * comment for why), a plain box this component positions itself from
 * `resolveDropPlacement`'s own answer, in the app's primary colour. Filling
 * this in and rendering it are one step, in one place, for the same reason
 * `handleGridDrop`, below, resolves the actual drop from the exact same
 * function: what an author sees while hovering is provably what they get.
 */
const DropGhost = styled.div`
  ${({ theme }) => css`
    position: absolute;
    pointer-events: none;
    background-color: ${theme.colorPrimaryBg};
    border: 2px dashed ${theme.colorPrimary};
    border-radius: ${theme.borderRadiusLG}px;
  `}
`;

/**
 * Finds the deepest dashboard container actually under a screen point,
 * ignoring `excludeEl`'s own subtree — the widget being dragged might itself
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

function rectsEqual(a: PackedRect, b: PackedRect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/**
 * One child, registered with GridStack via the two-level DOM structure its
 * own CSS requires (`.grid-stack-item` > `.grid-stack-item-content`) —
 * `WidgetView` itself needs no special handling for this, since it
 * only ever has to fill 100% of whatever box it's given, the same as it
 * already does for a flowed widget (`flowContent.tsx`'s `FlowItem`).
 *
 * `useLayoutEffect`, not `useEffect`: cleanup has to run, and
 * `unregisterItem` has to call `removeWidget`, before React detaches the
 * element, not after — a layout effect's cleanup runs before the DOM
 * mutation that unmounts it, where a passive effect's would run after.
 *
 * `registerItem`/`unregisterItem` only ever record which element belongs to
 * which node id here — nothing calls `makeWidget` from this component at
 * all. `useGridStack`'s own sync effect is what actually tells GridStack
 * about a newly-registered element, and it does that regardless of whether
 * this effect happened to run before or after `useGridStack`'s own init
 * effect created the `GridStack` instance in the first place (see that
 * hook's own doc comment) — this component doesn't have to know or care
 * which happened first.
 */
function GridStackItem({
  nodeId,
  registerItem,
  unregisterItem,
}: {
  nodeId: string;
  registerItem: (id: string, el: HTMLDivElement) => void;
  unregisterItem: (id: string) => void;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    registerItem(nodeId, el);
    return () => unregisterItem(nodeId);
  }, [nodeId, registerItem, unregisterItem]);

  return (
    <div ref={elRef} className="grid-stack-item">
      <div className="grid-stack-item-content">
        <WidgetView nodeId={nodeId} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

/**
 * The dashboard's own grid — not a Widget (see the composition/
 * layout design doc), which is why it lives here rather than in `widgets/`
 * alongside the things that get placed on it. There is exactly one of these
 * per dashboard, rendered for the root and only the root: `WidgetView`
 * resolves the root's renderer to this component directly, rather than
 * through the `dashboard.widgets` registry every real widget
 * goes through — nothing places a `RootGrid`, and nothing ever will, the same
 * way nothing places the dashboard itself.
 *
 * Backed by GridStack (see `useGridStack`, the only place that package is
 * imported). All position/size math — including collision handling — is
 * GridStack's: resizing a widget never shrinks a sibling, only displaces it
 * to the next open slot, which leaves every widget's own authored (hand- or
 * AI-set) span untouched — except a left/right *drop*, the one deliberate
 * exception, which does shrink a sibling (see `resolveDropPlacement`).
 * This component's job is translating between the stored
 * `col`/`row`/`colSpan`/`rowSpan` schema (which allows a child to omit its
 * position entirely, to be auto-placed) and GridStack's own `{x, y, w, h}`
 * — see `packChildLayout` for the auto-placement piece GridStack has no
 * concept of — and committing back to the store only once a gesture ends,
 * never on every intermediate frame.
 *
 * The palette's own native HTML5 drag stays exactly as it always has —
 * GridStack's own drag-in system uses a pointer-based DD engine that can't
 * see `dataTransfer`, so this draws its own drop preview (`DropGhost`)
 * instead of handing the gesture to GridStack at all.
 *
 * Dragging a widget into a *different* container (reparenting, as opposed to
 * repositioning within this one) is handled by hit-testing which
 * `data-container-id` is under the pointer when the drag ends — deliberately
 * not something GridStack (scoped to one grid instance) handles on its own.
 */
export default function RootGrid({ nodeId }: { nodeId: string }) {
  useDashboardRevision();
  const theme = useTheme();
  const node = provider.getNode(nodeId);
  // Ahead of the early return below, and computed off `node?.layout` rather
  // than `node.layout`: every hook this component calls (`useGridStack`
  // among them) has to run on every render, in the same order, whether or
  // not `node` turns out to exist.
  const metrics = resolveGridMetrics(node?.layout, theme);
  const children = node?.children ?? [];
  const packed = packChildLayout(children, metrics.columns, provider.getNode);

  // Not shown while hovering a nested container (see `handleGridDragOver`)
  // — that container's own drop target is where the preview belongs, not
  // here (see this component's own doc comment on the identical check the
  // previous, react-grid-layout-backed version of this made).
  const [ghostRect, setGhostRect] = useState<PackedRect | null>(null);
  // The existing widget's own *shrunk* half, while the cursor is hovering the
  // left/right split band of it — `resolveDropPlacement`'s `shrink`. Not a
  // second placeholder box: it feeds `previewPacked` (below, where
  // `useGridStack` is called), which makes the *real* widget visibly resize
  // to this rect for as long as the hover lasts — the same way a live drag
  // or resize elsewhere on this grid is never represented by a stand-in box
  // either. Kept as its own piece of state (rather than folded into
  // `ghostRect`) since committing a split still needs to know which
  // sibling and by how much, same as it always did.
  const [shrinkPreview, setShrinkPreview] = useState<{
    id: string;
    rect: PackedRect;
  } | null>(null);
  // A counter, not a plain boolean: this element isn't a single node, it's
  // the grid plus every item already on it, and the pointer crossing from
  // the container onto one of those fires a `dragleave` on the container
  // immediately followed by a `dragenter` on the child — a plain boolean
  // would read that as leaving entirely and flicker the ghost off for a
  // frame. Only reaching zero really means "gone".
  const dragOverCountRef = useRef(0);

  // `dragleave`/`drop` alone are not a complete story: releasing the
  // pointer somewhere that never became a drop target at all (past every
  // edge of the browser window, over a panel that isn't a drop target,
  // or the drag simply being cancelled with `Escape`) fires neither one on
  // this grid — the browser fires `dragend` on the *drag source* instead
  // (`Palette.tsx`'s own item), which bubbles to `document` regardless of
  // where the pointer ended up. This is the backstop for exactly that: it
  // always fires exactly once when a drag concludes, however it concluded,
  // so the ghost (and the enter/leave counter it depends on) can never be
  // left stuck on screen waiting for a `dragleave` that was never coming.
  useEffect(() => {
    const handleDragEnd = () => {
      dragOverCountRef.current = 0;
      setGhostRect(null);
      setShrinkPreview(null);
    };
    document.addEventListener('dragend', handleDragEnd);
    return () => document.removeEventListener('dragend', handleDragEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `handleGestureEnd`'s own real definition needs `containerRef` (returned
  // by the `useGridStack` call below) and `resolvePlacementAtPoint`/`columns`
  // (declared further down, after the `!node` early return) — but
  // `useGridStack` needs a gesture-end callback *now*, up here, ahead of
  // both, since every hook this component calls has to run unconditionally,
  // before any early return. This ref is the seam: `useGridStack` is handed
  // a stable function that only ever calls whatever this ref currently
  // holds, and the real `handleGestureEnd`, defined later once everything
  // it needs already exists, is written into it every render — the same
  // pattern `useGridStack` itself already uses internally for the identical
  // reason (see its own `onGestureEndRef`).
  const handleGestureEndRef = useRef<
    (items: GestureEndItem[], gesture: GestureEnd) => void
  >(() => {});

  // What `useGridStack` actually renders — `packed` with the split target's
  // own entry substituted for its shrunk-to half while `shrinkPreview` is
  // set. This is the real widget visibly resizing to preview the split, not
  // a second placeholder box drawn over it: `useGridStack`'s own sync
  // effect diffs this against GridStack's current node and calls `update`
  // on it exactly the way a committed resize would, then diffs right back
  // to `packed` the moment `shrinkPreview` clears (hover moves on, or the
  // drag ends), snapping the real widget back to its actual current size.
  // `resolveGridDropPlacement`/hit-testing below still reads the real,
  // unmodified `packed` — resolving a placement against an already-shrunk
  // neighbor would misread where its true edges are.
  const previewPacked = shrinkPreview
    ? { ...packed, [shrinkPreview.id]: shrinkPreview.rect }
    : packed;

  const { containerRef, registerItem, unregisterItem } = useGridStack({
    metrics,
    packed: previewPacked,
    cancelSelector: cancelSelectorFor(nodeId),
    onGestureEnd: (items, gesture) =>
      handleGestureEndRef.current(items, gesture),
  });

  if (!node) return null;

  const { columns } = metrics;

  /**
   * The core both `resolveGridDropPlacement` (below, a palette drag's own
   * `DragEvent`) and the reposition-split check in `handleGestureEnd` (a
   * `dragstop` gesture's own `clientX`/`clientY`, which carries no
   * `currentTarget` of its own to measure) ultimately want: what does
   * `resolveDropPlacement` say about this point, against this occupancy.
   * The two differ only in *how* they get the point and *which* occupancy
   * map to ask against — a reposition excludes the item being dragged from
   * it (it is the thing about to get a new position, not a fixed point to
   * test anyone else against); a fresh palette widget was never in `packed`
   * to begin with, so the plain, unmodified map is already correct for it.
   */
  const resolvePlacementAtPoint = (
    clientX: number,
    clientY: number,
    containerRect: DOMRect,
    packedForHitTest: Record<string, PackedRect> = packed,
  ): DropPlacement => {
    const cellGeometry = resolveCellGeometry(metrics, containerRect.width);
    const { col, row } = cellAtPoint(
      clientX - containerRect.left,
      clientY - containerRect.top,
      cellGeometry,
    );
    const exactCol = Math.min(columns - Number.EPSILON, Math.max(0, col));
    const exactRow = Math.max(0, row);
    return resolveDropPlacement(
      packedForHitTest,
      columns,
      exactCol,
      exactRow,
      FALLBACK_ROW_SPAN,
      FALLBACK_COL_SPAN,
    );
  };

  /**
   * Where a palette drag over this grid actually resolves — the single
   * entry point `handleGridDragOver`'s own live preview and `handleGridDrop`
   * both call with the same inputs, so what an author sees while hovering is
   * provably what they get on release.
   */
  const resolveGridDropPlacement = (
    event: ReactDragEvent<HTMLDivElement>,
  ): DropPlacement =>
    resolvePlacementAtPoint(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
    );

  /**
   * Where a palette drag actually lands, or where an existing widget's own
   * drag/resize settles — the single sink both gestures write through,
   * mirroring `handleGridDrop`/`handleExternalDrop`'s own "one path, so
   * preview and outcome can't quietly diverge" reasoning.
   *
   * A *drag* (never a resize) can be one of two other things before it is
   * ever just "committing wherever GridStack's own collision engine parked
   * everything":
   *
   * 1. A reparent — the dragged element's own bounding-rect centre is
   *    hit-tested for a `data-container-id` other than this one. Landing on
   *    itself or one of its own descendants throws (`moveWidget`'s
   *    own guard); that's caught and falls through to the checks below,
   *    same as any other drag.
   * 2. A split — the cursor's own final position (`gesture.clientX/clientY`,
   *    which GridStack's own `dd-draggable` copies off the underlying mouseup)
   *    is resolved through the same `resolvePlacementAtPoint` a palette
   *    drop's own preview/drop pair use, against every *other* sibling's own
   *    real, pre-drag position (the dragged item's own entry is excluded —
   *    it is the thing about to get a new position, not a fixed point to
   *    test anyone else against). Landing on a sibling's left/right split
   *    band shrinks that sibling and resizes the dragged item into the other
   *    half, in one commit — dragging an existing widget onto another's half
   *    is meant to read as the identical gesture a palette drop landing
   *    there already is, not a lesser version of it that only ever pushes
   *    things down instead.
   */
  const handleGestureEnd = (
    items: GestureEndItem[],
    gesture: GestureEnd,
  ): void => {
    if (gesture.kind === 'drag') {
      const rect = gesture.el.getBoundingClientRect();
      const targetContainerId = findContainerIdAt(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        gesture.el,
      );
      if (targetContainerId && targetContainerId !== nodeId) {
        try {
          // moveWidget itself clears col/row and clamps colSpan to
          // the destination's own column count — old coordinates were only
          // ever meaningful in *this* container's grid.
          const destIndex =
            provider.getNode(targetContainerId)?.children?.length ?? 0;
          provider.moveWidget(gesture.id, targetContainerId, destIndex);
          return;
        } catch {
          // Dropped onto itself or one of its own descendants — not a valid
          // reparent target. Fall through and commit layout instead.
        }
      }

      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const { [gesture.id]: _dragged, ...siblingsOnly } = packed;
        const placement = resolvePlacementAtPoint(
          gesture.clientX,
          gesture.clientY,
          containerRect,
          siblingsOnly,
        );
        if (placement.shrink) {
          const updates: Record<string, Partial<LayoutProps>> = {};
          items.forEach(({ id, rect: itemRect }) => {
            updates[id] = {
              col: itemRect.x + 1,
              row: itemRect.y + 1,
              colSpan: itemRect.w,
              rowSpan: itemRect.h,
            };
          });
          updates[gesture.id] = {
            col: placement.rect.x + 1,
            row: placement.rect.y + 1,
            colSpan: placement.rect.w,
            rowSpan: placement.rect.h,
          };
          updates[placement.shrink.id] = {
            col: placement.shrink.rect.x + 1,
            row: placement.shrink.rect.y + 1,
            colSpan: placement.shrink.rect.w,
            rowSpan: placement.shrink.rect.h,
          };
          provider.updateLayouts(updates);
          return;
        }
      }
    }

    const updates: Record<string, Partial<LayoutProps>> = {};
    items.forEach(({ id, rect }) => {
      updates[id] = {
        col: rect.x + 1,
        row: rect.y + 1,
        colSpan: rect.w,
        rowSpan: rect.h,
      };
    });
    provider.updateLayouts(updates);
  };
  handleGestureEndRef.current = handleGestureEnd;

  /**
   * Live preview while a palette drag hovers this grid's own rendered
   * area — the counterpart to `handleGridDrop`, below, which resolves the
   * actual drop from the exact same `resolveGridDropPlacement` call so what
   * an author sees while hovering is provably what they get on release.
   * Drives both `ghostRect` (the new widget's own preview) and
   * `shrinkPreview` (the existing widget's shrunk half, only set while
   * hovering a left/right split band — see `resolveDropPlacement`'s own
   * doc comment for the other two bands, which never set it).
   *
   * Hovering over a *nested* container (a `tabs`/`collapsible`/`carousel`
   * widget sitting on this grid, or anything a third party contributes)
   * clears both previews instead: that container has its own drop target
   * (`FlowContent`/`EmptyArea`, tagged `data-container-id`, the same way
   * this component's own `GridSurface` is) and is where the widget actually
   * belongs, not beside or on top of the container's own card on *this*
   * grid. Without this, both would react to the same hover, and only one of
   * them ever runs its own cleanup on drop.
   */
  const handleGridDragOver = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes(PALETTE_MIME)) return;

    const hoveredContainerId = (
      event.target as HTMLElement
    ).closest<HTMLElement>('[data-container-id]')?.dataset.containerId;
    if (hoveredContainerId && hoveredContainerId !== nodeId) {
      setGhostRect(null);
      setShrinkPreview(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';

    const { rect, shrink } = resolveGridDropPlacement(event);
    setGhostRect(previous =>
      previous && rectsEqual(previous, rect) ? previous : rect,
    );
    setShrinkPreview(previous => {
      if (!shrink) return previous === null ? previous : null;
      if (
        previous &&
        previous.id === shrink.id &&
        rectsEqual(previous.rect, shrink.rect)
      ) {
        return previous;
      }
      return shrink;
    });
  };

  const handleGridDragEnter = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (event.dataTransfer.types.includes(PALETTE_MIME)) {
      dragOverCountRef.current += 1;
    }
  };

  const handleGridDragLeave = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes(PALETTE_MIME)) return;
    dragOverCountRef.current = Math.max(0, dragOverCountRef.current - 1);
    if (dragOverCountRef.current === 0) {
      setGhostRect(null);
      setShrinkPreview(null);
    }
  };

  /**
   * Where a palette drag actually lands, once released — the counterpart to
   * `GridSurface`'s own plain `onDrop` (below, for a drop that missed the
   * grid entirely, into the leftover space past its last row): this one
   * fires for a drop anywhere over the grid's own rendered rows, resolving
   * the same `resolveGridDropPlacement` call the previews it's replacing
   * already showed, plus where among the existing children this new one's
   * own row/col actually falls (see `placeBlockAt`'s own doc comment for why
   * that has to be figured out here rather than left to default to "at the
   * end").
   *
   * A `shrink` result commits in two calls, shrink *first* — see
   * `DashboardProvider.addWidget`'s own call to
   * `resolveParentCollisions`: with the neighbor already shrunk, the new
   * widget never overlaps anything when that collision pass runs, so nothing
   * is disturbed. Inserting first would overlap the still-wide neighbor and
   * get pushed straight down by that same collision rule instead, which
   * would permanently destroy the split before it ever rendered. All four
   * of the neighbor's own layout fields are pinned, not just `col`/`colSpan`
   * — `packChildLayout` re-auto-places any child missing `col`/`row` on
   * every render, so a partially-written neighbor would drift apart from
   * its new sibling on the very next one.
   *
   * `readingOrderIndex` is computed against `packed` — the *pre-shrink* map,
   * still true to what's on screen at the moment of drop — which is correct
   * for all four outcomes (left-split, right-split, push-above, push-below):
   * verified case by case when `resolveDropPlacement` itself was written.
   */
  const handleGridDrop = (event: ReactDragEvent<HTMLDivElement>): void => {
    const type = event.dataTransfer.getData(PALETTE_MIME);
    dragOverCountRef.current = 0;
    setGhostRect(null);
    setShrinkPreview(null);
    if (!type) return;

    const hoveredContainerId = (
      event.target as HTMLElement
    ).closest<HTMLElement>('[data-container-id]')?.dataset.containerId;
    if (hoveredContainerId && hoveredContainerId !== nodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const { rect, shrink } = resolveGridDropPlacement(event);

    const readingOrderIndex = children.findIndex(id => {
      const sibling = packed[id];
      return (
        sibling.y > rect.y || (sibling.y === rect.y && sibling.x >= rect.x)
      );
    });
    const index =
      readingOrderIndex === -1 ? children.length : readingOrderIndex;

    if (shrink) {
      provider.updateLayouts({
        [shrink.id]: {
          col: shrink.rect.x + 1,
          row: shrink.rect.y + 1,
          colSpan: shrink.rect.w,
          rowSpan: shrink.rect.h,
        },
      });
    }
    placeBlockAt(nodeId, type, index, {
      col: rect.x + 1,
      row: rect.y + 1,
      colSpan: rect.w,
      rowSpan: rect.h,
    });
  };

  return (
    <GridSurface
      data-container-id={nodeId}
      data-test="grid-container"
      // The grid itself (`GridStackContainer`, below) now answers a drop
      // anywhere over its own rendered rows — this pair only still fires
      // for the leftover space past its last row (the grid is only ever as
      // tall as its own `min-height` floor plus whatever content needs, and
      // this element can still be taller), where appending full-width at
      // the end is still the right answer, the same one it always was.
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
      <GridStackContainer
        className="grid-stack"
        ref={containerRef}
        onDragEnter={handleGridDragEnter}
        onDragOver={handleGridDragOver}
        onDragLeave={handleGridDragLeave}
        onDrop={handleGridDrop}
      >
        {children.map(childId => (
          <GridStackItem
            key={childId}
            nodeId={childId}
            registerItem={registerItem}
            unregisterItem={unregisterItem}
          />
        ))}
        {ghostRect &&
          (() => {
            const containerBox = containerRef.current?.getBoundingClientRect();
            const containerWidthPx = containerBox?.width ?? 0;
            const cellGeometry = resolveCellGeometry(metrics, containerWidthPx);
            const pixelRect = pixelRectForCell(ghostRect, cellGeometry);
            return (
              <DropGhost
                data-test="grid-drop-ghost"
                style={{
                  left: pixelRect.left,
                  top: pixelRect.top,
                  width: pixelRect.width,
                  height: pixelRect.height,
                }}
              />
            );
          })()}
      </GridStackContainer>
    </GridSurface>
  );
}
