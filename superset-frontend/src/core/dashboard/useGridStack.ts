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

/**
 * @fileoverview The one place `gridstack` itself is ever imported. `RootGrid`
 * owns the dashboard-specific meaning of a gesture (committing a layout,
 * detecting a reparent, previewing a palette drop) — this hook owns only the
 * mechanics of keeping a `GridStack` instance, its DOM, and this app's own
 * `Record<string, PackedRect>` in agreement with each other.
 *
 * Two rules make a React-owned child list and a GridStack-owned DOM position
 * coexist safely, threaded through everything below:
 *
 * 1. Only `syncWidgets` (the effect keyed on `packed`) ever calls
 *    `makeWidget`/`update`, and only when the two actually disagree. Nothing
 *    here ever listens for GridStack's own `'change'` event — that fires for
 *    `syncWidgets`'s own writes too, and committing from it would be a
 *    write loop: commit → revision tick → re-render → `syncWidgets` writes
 *    into GridStack → `'change'` fires → commit again.
 * 2. `registerItem`/`unregisterItem` only ever record *which* element
 *    belongs to *which* node id — they never call a GridStack method
 *    directly (except `removeWidget` on the way out, where there is no
 *    "sync later" to defer to). `syncWidgets` is the only thing that ever
 *    tells GridStack about an element for the first time, which is what
 *    makes the ordering in `RootGrid`'s own `GridStackItem` safe regardless
 *    of whether a child's own mount effect runs before this hook's init
 *    effect has actually created a `GridStack` instance yet — see
 *    `syncWidgets`'s own comment.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { GridStack } from 'gridstack';
import type { GridItemHTMLElement, GridStackNode } from 'gridstack';
import type { PackedRect } from './gridPacking';
import type { GridMetrics } from './layoutStyle';

/** One child's settled position once a drag or resize gesture ends — `RootGrid`'s own counterpart to react-grid-layout's `Layout` array. */
export interface GestureEndItem {
  id: string;
  rect: PackedRect;
}

/** Which gesture just ended, on which node, and the element it ended on — enough for `RootGrid` to decide for itself whether this was a plain resize/reposition or a drag that landed in a different container (see `findContainerIdAt`, which this hook has no reason to know about). */
export interface GestureEnd {
  kind: 'drag' | 'resize';
  id: string;
  el: GridItemHTMLElement;
  /**
   * Where the pointer actually was when the gesture ended, in viewport
   * pixels — GridStack's own `dd-draggable`/`dd-resizable` copy these off
   * the underlying native mouseup (`Utils.initEvent`), so they're reliably
   * present for a real mouse or touch gesture. `RootGrid` needs this to
   * tell whether a *drag* (not a resize) ended on another sibling's own
   * left/right split band — the same question `resolveDropPlacement`
   * already answers for a palette drop, asked here against the cursor's
   * final position rather than a `DragEvent`'s.
   */
  clientX: number;
  clientY: number;
}

export interface UseGridStackArgs {
  metrics: GridMetrics;
  packed: Record<string, PackedRect>;
  /** The `draggableCancel`-equivalent selector — regions a press must never start a drag from (the remove button, a nested container, a flow resize grip, a header control). Threaded in rather than hardcoded here, since it's dashboard markup this hook has no other reason to know about. */
  cancelSelector: string;
  onGestureStart?: (kind: 'drag' | 'resize', id: string) => void;
  onGestureEnd: (items: GestureEndItem[], gesture: GestureEnd) => void;
}

export interface UseGridStackResult {
  /**
   * The `.grid-stack` element itself — pass directly as `ref={containerRef}`
   * on the container div, and read `containerRef.current` anywhere this
   * hook's own caller needs the live DOM node (`RootGrid`'s own drop-preview
   * reads it every render, to measure the container's current width and turn
   * a cell rect into a pixel one via `pixelRectForCell`). A plain
   * `RefObject`, not a callback: a callback ref has no `.current` of its own
   * to read, and casting one to something that pretends it does reads
   * `undefined` forever — silently, with no crash and no lint error — which
   * is exactly the bug that once made the drop-preview's width collapse to
   * its own border while its height (fixed pixels, independent of container
   * width) kept looking fine. Exposing the ref object itself, rather than a
   * callback plus a separate getter for the same node, removes that whole
   * failure mode by construction: there is only one way to reach this DOM
   * node from outside the hook, and it behaves exactly like every other
   * `RefObject` in React.
   */
  containerRef: RefObject<HTMLDivElement>;
  /** Call from a grid item's own mount — see `RootGrid`'s `GridStackItem`. */
  registerItem: (id: string, el: HTMLDivElement) => void;
  /** Call from a grid item's own unmount cleanup, before it detaches. */
  unregisterItem: (id: string) => void;
}

function readGestureItems(grid: GridStack): GestureEndItem[] {
  return grid
    .getGridItems()
    .map(el => el.gridstackNode)
    .filter((node): node is GridStackNode => !!node?.id)
    .map(node => ({
      id: node.id as string,
      rect: { x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1 },
    }));
}

export function useGridStack({
  metrics,
  packed,
  cancelSelector,
  onGestureStart,
  onGestureEnd,
}: UseGridStackArgs): UseGridStackResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);
  const itemElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Read by the `dragstart`/`dragstop`/etc. listeners the init effect below
  // registers once — they're never torn down and re-attached per render, so
  // they need whichever callback is *currently* current, not whichever one
  // was passed in on the render that created them.
  const onGestureStartRef = useRef(onGestureStart);
  onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd);
  onGestureEndRef.current = onGestureEnd;

  // `useCallback`'d with an empty dep array — they only ever touch refs,
  // never a render-scoped value — so a consumer (`GridStackItem`) can safely
  // list one in its own effect deps without that effect re-firing on every
  // unrelated render of whatever's above it.
  const registerItem = useCallback((id: string, el: HTMLDivElement): void => {
    itemElsRef.current.set(id, el);
  }, []);

  const unregisterItem = useCallback((id: string): void => {
    const el = itemElsRef.current.get(id);
    itemElsRef.current.delete(id);
    if (el) gridRef.current?.removeWidget(el, false);
  }, []);

  // Init, once. Deliberately not re-run when `metrics` changes later — a
  // later change is applied imperatively (the next effect), never by
  // re-initializing, which would throw away every widget's own DOM
  // registration.
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const { columns, gap, rowUnitPx } = metrics;
    const grid = GridStack.init(
      {
        column: columns,
        cellHeight: rowUnitPx + gap,
        margin: gap / 2,
        // Widgets never overlap regardless of `float` — this only turns off
        // the *second*, library-owned compaction pass that would otherwise
        // fight `packChildLayout`'s own auto-placement (already gravity-style,
        // computed from the stored data) for the same job. Left open by
        // `availableDropSpan`, a gap should stay a gap.
        float: true,
        // GridStack's own default (`auto: true`) scans the container for
        // any `.grid-stack-item` elements *already in the DOM* the moment
        // `init` runs and silently registers them itself — reading position
        // from `gs-x`/`gs-y`/... attributes we never write and, critically,
        // an `id` from a `gs-id` attribute we never write either. React has
        // already rendered every initially-mounted `GridStackItem` by the
        // time this effect runs (a passive effect always runs after every
        // layout effect in the same commit, including the child's own
        // `registerItem` one), so without this, every item present at
        // mount gets silently claimed with `id: undefined` before
        // `syncWidgets` ever gets a chance to call `makeWidget` on it —
        // which then makes every gesture-end handler's `!!node?.id` filter
        // (`useGridStack`'s `readGestureItems`) drop it, so nothing about it
        // is ever committed and it springs back to its last known position
        // on the very next drag or resize. `syncWidgets` is the only thing
        // that is ever allowed to introduce an element to GridStack (see
        // this module's own doc comment) — this is what actually makes
        // that true, rather than just documenting an intent GridStack's own
        // default quietly undermines.
        auto: false,
        // The palette's own native HTML5 drag stays exactly as it is —
        // GridStack's own drag-in system uses its own pointer-based DD
        // engine, not `dataTransfer`, and can't see it. `RootGrid` draws its
        // own drop preview instead (see `resolveDropPlacement`).
        acceptWidgets: false,
        removable: false,
        // CSS transitions racing the very next render's own DOM write is one
        // more thing to rule out, not something worth animating.
        animate: false,
        resizable: { handles: 'se, sw, nw, ne' },
        draggable: { cancel: cancelSelector },
      },
      containerRef.current,
    );
    gridRef.current = grid;

    if (!grid) return undefined;

    const handleDragStart = (_event: Event, el: GridItemHTMLElement) =>
      onGestureStartRef.current?.('drag', el.gridstackNode?.id ?? '');
    const handleResizeStart = (_event: Event, el: GridItemHTMLElement) =>
      onGestureStartRef.current?.('resize', el.gridstackNode?.id ?? '');
    const handleDragStop = (event: Event, el: GridItemHTMLElement) => {
      const { clientX = 0, clientY = 0 } = event as unknown as {
        clientX?: number;
        clientY?: number;
      };
      onGestureEndRef.current(readGestureItems(grid), {
        kind: 'drag',
        id: el.gridstackNode?.id ?? '',
        el,
        clientX,
        clientY,
      });
    };
    const handleResizeStop = (event: Event, el: GridItemHTMLElement) => {
      const { clientX = 0, clientY = 0 } = event as unknown as {
        clientX?: number;
        clientY?: number;
      };
      onGestureEndRef.current(readGestureItems(grid), {
        kind: 'resize',
        id: el.gridstackNode?.id ?? '',
        el,
        clientX,
        clientY,
      });
    };

    grid.on('dragstart', handleDragStart);
    grid.on('resizestart', handleResizeStart);
    grid.on('dragstop', handleDragStop);
    grid.on('resizestop', handleResizeStop);

    return () => {
      grid.destroy(false);
      gridRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync, whenever `packed` changes — and, since effects within one
  // component run in the order they're declared, also once on mount, right
  // after the init effect above (regardless of whether any `GridStackItem`
  // already registered *before* that init effect ran: a child's own mount
  // effect is a layout effect, which the whole subtree runs before any
  // component's plain `useEffect` runs at all, so `itemElsRef` is already
  // populated the first time this ever executes).
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    grid.batchUpdate();
    try {
      Object.entries(packed).forEach(([id, rect]) => {
        const el = itemElsRef.current.get(id);
        if (!el) return;
        const node = (el as GridItemHTMLElement).gridstackNode;
        if (!node) {
          grid.makeWidget(el, { id, ...rect });
        } else if (
          node.x !== rect.x ||
          node.y !== rect.y ||
          node.w !== rect.w ||
          node.h !== rect.h
        ) {
          grid.update(el, rect);
        }
      });
    } finally {
      grid.batchUpdate(false);
    }
  }, [packed]);

  // Metrics change (the root's own columns/gap/rowUnit, edited after the
  // grid already exists) — applied imperatively, `'none'` so widgets keep
  // exactly the position `packChildLayout` already gave them rather than
  // GridStack's own default rescale-on-column-change fighting it.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.column(metrics.columns, 'none');
    grid.margin(metrics.gap / 2);
    grid.cellHeight(metrics.rowUnitPx + metrics.gap);
  }, [metrics]);

  return { containerRef, registerItem, unregisterItem };
}
