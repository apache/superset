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
 * @fileoverview One grid of a canvas, with drag and resize built in.
 *
 * There is no edit mode: a user who may edit gets a drag grip and a resize
 * corner on each widget, on the canvas as they view it. A user who may not
 * gets the same grid with no handles. Dragging never covers the widget's own
 * surface, so a filter or chart underneath stays clickable.
 *
 * While a gesture is live the widget follows the pointer and a dashed outline
 * marks the cells it would take; releasing persists exactly those cells.
 */

import {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components';
import {
  GridMetrics,
  gridDelta,
  movedPlacement,
  NO_DELTA,
  RESIZE_CORNERS,
  type ResizeCorner,
  resizedPlacement,
  samePlacement,
} from './gridGeometry';
import { previewGrid, type GridLayout } from './resolveGrid';
import type { GridPlacement, SpanConstraints } from './types';

type GestureKind = 'move' | 'resize';

interface Gesture {
  nodeId: string;
  kind: GestureKind;
  pointerId: number;
  startX: number;
  startY: number;
  /**
   * Where the grid sat in the viewport when the widget was grabbed.
   *
   * Pointer coordinates are relative to the viewport, so scrolling
   * mid-gesture moves the content under a still pointer and the drag would
   * report no movement at all. The grid's own position is what this measures
   * against rather than the page's scroll offset: the canvas does not
   * necessarily scroll the window -- with the chat panel open the shell is
   * locked and the content scrolls inside it -- and the grid's rect moves for
   * any scrolling ancestor, the window included.
   */
  startLeft: number;
  startTop: number;
  dx: number;
  dy: number;
  /**
   * Where the pointer was last seen. Scrolling moves the content without
   * moving the pointer, so recomputing then needs the position it held.
   */
  lastX: number;
  lastY: number;
  /**
   * Where the widget sat when it was grabbed. The gesture resolves against
   * this, not against the current placement: a write landing mid-gesture (a
   * sibling's drop pushing this one down, or a draft poll) would otherwise
   * move the ground under the pointer and persist the drop relative to a row
   * the user never aimed at.
   */
  origin: GridPlacement;
  /**
   * Whether this gesture is actually dragging yet. One begun on a handle is
   * armed at once; one begun on the widget body waits until the pointer has
   * travelled `DRAG_THRESHOLD`, so a press that turns out to be a click
   * reaches the widget underneath instead of nudging it.
   */
  armed: boolean;
  /**
   * The element the press landed on, so a gesture that arms later can take
   * the pointer from it. Held rather than looked up when it arms: by then the
   * pointer may be over something else entirely.
   */
  capture: HTMLElement;
  /** For a resize, the corner being dragged; the opposite one stays put. */
  corner: ResizeCorner;
}

/** Pixels of travel before a press on a widget body becomes a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Presses already claimed by a grid, so one that bubbles through nested grids
 * starts exactly one gesture: the innermost grid's.
 */
const claimedPresses = new WeakSet<Event>();

/**
 * Controls that handle press-and-drag themselves, so a press on one must not
 * also move the widget: a filter's slider, a form control, a link, a handle
 * for reordering something inside a widget. `data-canvas-no-drag` lets a
 * widget opt anything else out.
 */
const OWN_GESTURE = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[role="slider"]',
  '[role="button"]',
  '[role="scrollbar"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[draggable="true"]',
  '[data-canvas-no-drag]',
].join(',');

/**
 * Whether a press landed on a scrollbar rather than inside the content.
 *
 * A scrollbar belongs to the element it scrolls and dragging it scrolls, so a
 * widget tall enough to scroll -- a table, usually -- would otherwise be
 * impossible to scroll by hand in a plan. `clientWidth`/`clientHeight` stop
 * short of the scrollbar, so a press past either is on it; the comparison is
 * skipped for an element that isn't overflowing, which has no scrollbar to
 * press. A left-hand scrollbar (RTL) is not detected.
 */
const onScrollbar = (
  target: Element,
  clientX: number,
  clientY: number,
): boolean => {
  const box = target.getBoundingClientRect();
  return (
    (target.scrollHeight > target.clientHeight &&
      clientX > box.left + target.clientWidth) ||
    (target.scrollWidth > target.clientWidth &&
      clientY > box.top + target.clientHeight)
  );
};

/** Whether something inside the widget owns this press, so the grid doesn't. */
const ownsPress = (event: ReactPointerEvent<HTMLElement>): boolean => {
  const { target } = event;
  if (!(target instanceof Element)) return false;
  const owner = target.closest(OWN_GESTURE);
  // Bounded to this widget: a control that happens to sit above the grid in
  // the page isn't what the press landed on.
  return (
    (owner !== null && event.currentTarget.contains(owner)) ||
    onScrollbar(target, event.clientX, event.clientY)
  );
};

/**
 * A gesture's movement across the grid, scrolling included.
 *
 * `left`/`top` are where the grid sits in the viewport now. Content scrolling
 * under a still pointer moves the grid's rect, and the widget has travelled by
 * that much relative to the grid even though the pointer has not moved.
 */
const travelled = (
  gesture: Gesture,
  clientX: number,
  clientY: number,
  left: number,
  top: number,
) => ({
  dx: clientX - gesture.startX - (left - gesture.startLeft),
  dy: clientY - gesture.startY - (top - gesture.startTop),
});

const Grid = styled.div<GridMetrics>`
  display: grid;
  grid-template-columns: repeat(${({ columns }) => columns}, minmax(0, 1fr));
  grid-auto-rows: ${({ rowUnit }) => rowUnit}px;
  gap: ${({ gap }) => gap}px;
`;

const GridItem = styled.div<{
  placement?: GridPlacement;
  dragging?: boolean;
  offset?: { x: number; y: number };
}>`
  ${({ theme, placement, dragging, offset }) => css`
    min-width: 0;
    min-height: 0;
    position: relative;
    ${
      placement &&
      css`
        grid-column: ${placement.col} / span ${placement.colSpan};
        grid-row: ${placement.row} / span ${placement.rowSpan};
      `
    }
    ${
      dragging &&
      offset &&
      css`
        /* Follow the pointer without reflowing the grid under it. */
        transform: translate(${offset.x}px, ${offset.y}px);
        z-index: 2;
        opacity: 0.85;
        /*
         * A widget draws no background of its own, so at less than full
         * opacity the neighbours and the drop outline show through the one
         * being dragged and it reads as sliding underneath them. The fill and
         * the shadow are what make it read as lifted.
         */
        background: ${theme.colorBgContainer};
        box-shadow: ${theme.boxShadowSecondary};
        border-radius: ${theme.borderRadius}px;
      `
    }
  `}
`;

/**
 * Where the widget being dragged will land. No error state: the neighbours
 * are already rendered where they will end up, so an overlap shows as them
 * moving aside rather than as a warning colour here.
 */
const DropPreview = styled.div<{ placement: GridPlacement }>`
  ${({ theme, placement }) => css`
    grid-column: ${placement.col} / span ${placement.colSpan};
    grid-row: ${placement.row} / span ${placement.rowSpan};
    border: 2px dashed ${theme.colorPrimary};
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorPrimaryBg};
    pointer-events: none;
    z-index: 1;
  `}
`;

/**
 * Wraps a widget so its handles can sit on top of it. The handles stay hidden
 * until the pointer is over the widget or a handle has focus, so a canvas at
 * rest looks the same whether or not the user may edit it.
 *
 * Only the innermost hovered widget shows its handles and its outline:
 * `:hover` matches every ancestor, so a container would otherwise light up
 * alongside whichever of its children the pointer is actually over.
 */
const Interactive = styled.div`
  ${({ theme }) => css`
    height: 100%;
    position: relative;
    border-radius: ${theme.borderRadius}px;
    transition: box-shadow ${theme.motionDurationMid};

    /* Direct children only: hovering a container must not reveal the
       handles of every widget nested inside it. */
    & > .canvas-handle {
      opacity: 0;
      /*
       * Transparent is not absent: without this a hidden handle still wins
       * the hit test over whatever it happens to sit above.
       */
      pointer-events: none;
      transition: opacity ${theme.motionDurationMid};
    }

    &:hover:not(:has(.canvas-interactive:hover)) {
      /* Borderless widgets (a metric tile, say) otherwise give no clue which
         widget the handles belong to. */
      box-shadow: 0 0 0 1px ${theme.colorBorder};
    }

    &:hover:not(:has(.canvas-interactive:hover)) > .canvas-handle,
    & > .canvas-handle:focus-visible {
      opacity: 1;
      pointer-events: auto;
    }
  `}
`;

/** Step between a container's handles and its children's, in size units. */
const HANDLE_STEP = 8;
/** Size units a handle itself needs, so an offset can leave room for it. */
const HANDLE_BOX = 7;

/**
 * How far a nested grid's handles sit from the widget's edge.
 *
 * Nesting steps the offset so a container's handle never lands exactly on its
 * child's, but it is clamped to the widget's own rendered box: pushing past
 * that would put the handle over the *next* widget, where it would take
 * presses meant for that one.
 */
const handleOffset = (
  sizeUnit: number,
  depth: number,
  extent: number,
): number => {
  const room = Math.max(sizeUnit, extent - sizeUnit * HANDLE_BOX);
  return Math.min(sizeUnit * (1 + depth * HANDLE_STEP), room);
};

/**
 * The widget itself, kept inside the cells it was given.
 *
 * A widget renders at its natural height — a table with every row, say — so
 * without this it spills past its own box and over whatever is below. The
 * handles are siblings rather than children, so they stay pinned to the box
 * while the content scrolls behind them.
 */
const Content = styled.div<{ editable: boolean }>`
  ${({ editable }) => css`
    height: 100%;
    overflow: auto;
    ${
      editable &&
      css`
        /*
       * Dragging across text would otherwise select it and move the widget at
       * once. In a plan the drag wins -- arranging is what a plan is for --
       * and the published canvas selects normally.
       */
        user-select: none;

        /*
         * While a widget inside this one is being dragged, stop clipping. A
         * child dragged towards the edge of its container is leaving the
         * container's box, and scrolling it back into view is the opposite of
         * what the gesture means -- it would cut the widget off at the edge
         * and grow a scrollbar. Only an ancestor matches: the dragged widget's
         * own content does not contain its grid cell.
         */
        &:has([data-dragging='true']) {
          overflow: visible;
        }
      `
    }
  `}
`;

const Grip = styled.button<{ depth: number; extent: number }>`
  ${({ theme, depth, extent }) => css`
    position: absolute;
    top: ${handleOffset(theme.sizeUnit, depth, extent)}px;
    /* Deeper handles above shallower ones: the innermost wins a shared spot. */
    z-index: ${3 + depth};
    /*
     * Left of both the north-east resize corner (4 units at the corner) and a
     * widget's own controls, which step aside to 5 units while a plan is open
     * and are 8 units wide (see WithQuery's .canvas-widget-controls). These
     * handles sit above them in the stack, so overlapping would swallow
     * presses meant for the menu.
     */
    right: ${theme.sizeUnit * 14}px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${theme.sizeUnit / 2}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadiusSM}px;
    background: ${theme.colorBgElevated};
    color: ${theme.colorTextSecondary};
    cursor: grab;
    touch-action: none;

    &:active {
      cursor: grabbing;
    }
  `}
`;

/** Human-readable names for the four corners, for the handle labels. */
const CORNER_NAMES: Record<ResizeCorner, () => string> = {
  nw: () => t('top left'),
  ne: () => t('top right'),
  sw: () => t('bottom left'),
  se: () => t('bottom right'),
};

const ResizeCorner = styled.button<{
  corner: ResizeCorner;
  depth: number;
  extent: number;
}>`
  ${({ theme, corner, depth, extent }) => {
    const west = corner === 'nw' || corner === 'sw';
    const north = corner === 'nw' || corner === 'ne';
    /*
     * Stepped like the grip: a container's box shares its edges with its
     * first and last child's, and the container's handles paint later, so
     * sharing the pixel would make the child's corner unreachable.
     */
    const inset =
      depth === 0 ? 0 : handleOffset(theme.sizeUnit, depth - 1, extent);
    return css`
      position: absolute;
      ${west ? 'left' : 'right'}: ${inset}px;
      ${north ? 'top' : 'bottom'}: ${inset}px;
      z-index: ${3 + depth};
      width: ${theme.sizeUnit * 4}px;
      height: ${theme.sizeUnit * 4}px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: ${west === north ? 'nwse-resize' : 'nesw-resize'};
      touch-action: none;

      /* A two-line corner, the conventional resize affordance. */
      &::after {
        content: '';
        position: absolute;
        ${west ? 'left' : 'right'}: ${theme.sizeUnit / 2}px;
        ${north ? 'top' : 'bottom'}: ${theme.sizeUnit / 2}px;
        width: ${theme.sizeUnit * 2}px;
        height: ${theme.sizeUnit * 2}px;
        border-${west ? 'left' : 'right'}: 2px solid ${theme.colorTextTertiary};
        border-${north ? 'top' : 'bottom'}: 2px solid ${theme.colorTextTertiary};
      }
    `;
  }}
`;

/** The grid's content width, kept current as the viewport changes. */
function useElementWidth(): [(element: HTMLDivElement | null) => void, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!element) return undefined;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width];
}

export interface CanvasGridSurfaceProps {
  childIds: string[];
  columns: number;
  gap: number;
  rowUnit: number;
  placements: Record<string, GridPlacement>;
  /**
   * Each child's stored layout. The preview resolves from these, as the
   * server does: an auto-placed child has no `col`/`row`, and resolving from
   * the rectangle it currently occupies would pin it there in the preview
   * while the server still places it freely.
   */
  layouts: Record<string, GridLayout>;
  constraints: Record<string, SpanConstraints>;
  /** Whether the user may drag and resize these widgets. */
  editable: boolean;
  /**
   * How deeply this grid is nested. A container's box begins where its first
   * child's does and its handles paint last, so without an offset per level a
   * container's grip would sit over its child's and swallow the click.
   */
  depth: number;
  onPlace: (nodeId: string, placement: GridPlacement) => void;
  renderNode: (nodeId: string) => ReactNode;
}

export default function CanvasGridSurface({
  childIds,
  columns,
  gap,
  rowUnit,
  placements,
  layouts,
  constraints,
  editable,
  depth,
  onPlace,
  renderNode,
}: CanvasGridSurfaceProps) {
  const [measureGrid, width] = useElementWidth();
  // The grid node, for reading where it sits in the viewport mid-gesture.
  const grid = useRef<HTMLDivElement | null>(null);
  const gridRef = useCallback(
    (node: HTMLDivElement | null) => {
      grid.current = node;
      measureGrid(node);
    },
    [measureGrid],
  );

  /**
   * Where the grid sits in the viewport. Falls back to the gesture's own
   * origin when the node has gone, so a vanished grid reports no scrolling
   * rather than a jump to zero.
   */
  const originOf = useCallback((gesture: Gesture) => {
    const box = grid.current?.getBoundingClientRect();
    return box
      ? { left: box.left, top: box.top }
      : { left: gesture.startLeft, top: gesture.startTop };
  }, []);
  const [gesture, setGesture] = useState<Gesture>();
  // The handlers read the gesture directly, so committing never runs as a
  // side effect inside a state updater.
  const live = useRef<Gesture>();

  const update = useCallback((next: Gesture | undefined) => {
    live.current = next;
    setGesture(next);
  }, []);

  /** Where `from` would land given a pointer delta, in whole grid units. */
  const targetOf = useCallback(
    (
      nodeId: string,
      kind: GestureKind,
      from: GridPlacement,
      dx: number,
      dy: number,
      corner: ResizeCorner = 'se',
    ) => {
      const metrics: GridMetrics = { columns, gap, rowUnit };
      const delta = width > 0 ? gridDelta(dx, dy, width, metrics) : NO_DELTA;
      return kind === 'move'
        ? movedPlacement(from, delta, columns)
        : resizedPlacement(from, delta, columns, constraints[nodeId], corner);
    },
    [width, columns, gap, rowUnit, constraints],
  );

  /**
   * Persists `next` for `nodeId`, where `from` is the placement the gesture
   * resolved against.
   *
   * Both no-op checks matter. A gesture that moved nothing resolves back to
   * `from`, and sending that would write the geometry the widget had when it
   * was grabbed over anything that landed while the button was held -- a plain
   * click on a handle would revert a draft poll or another editor's resize.
   * Comparing with the current placement then drops a gesture that happens to
   * land exactly where the widget already sits.
   */
  const commit = useCallback(
    (nodeId: string, next: GridPlacement | undefined, from: GridPlacement) => {
      const placement = placements[nodeId];
      if (!next || !placement) return;
      if (samePlacement(next, from) || samePlacement(next, placement)) return;
      onPlace(nodeId, next);
    },
    [onPlace, placements],
  );

  const begin =
    (
      nodeId: string,
      kind: GestureKind,
      armed = true,
      corner: ResizeCorner = 'se',
    ) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      // React routes events from a portalled child through this handler even
      // though it renders outside this subtree, so a press inside a modal the
      // widget opened arrives here looking like a press on the widget. The
      // DOM knows better than the React tree does.
      if (
        !(event.target instanceof Node) ||
        !event.currentTarget.contains(event.target)
      ) {
        return;
      }
      // Only a deferred press is checked. A handle press is unambiguous, and
      // a handle is itself a button, so checking it would reject every one.
      if (!armed && ownsPress(event)) return;
      // One gesture at a time. A second finger on another handle also reports
      // button 0, and letting it replace the live gesture would strand the
      // first pointer: its move and up events fail the pointerId guards, so
      // its drag would be dropped without ever being committed.
      if (live.current) return;
      const origin = placements[nodeId];
      if (!origin) return;
      // A deferred press does not stop propagation -- a click has to reach
      // the widget -- so it bubbles to this grid and to every grid containing
      // it, and each would start its own gesture. The innermost runs first
      // and claims the press; the rest stand down.
      if (claimedPresses.has(event.nativeEvent)) return;
      claimedPresses.add(event.nativeEvent);
      // Where the grid sits now, so later moves can tell scrolling apart from
      // pointer travel.
      const box = grid.current?.getBoundingClientRect();
      if (armed) {
        event.preventDefault();
        event.stopPropagation();
        // A handle owns the pointer from the first move. A deferred press
        // must not, or the release and the click after it would be
        // retargeted here from whatever was actually pressed.
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      update({
        nodeId,
        kind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: box?.left ?? 0,
        startTop: box?.top ?? 0,
        dx: 0,
        dy: 0,
        lastX: event.clientX,
        lastY: event.clientY,
        origin,
        armed,
        capture: event.currentTarget,
        corner,
      });
    };

  /**
   * A live gesture is moved and released from the window, not from the widget
   * it started on.
   *
   * An unarmed body press holds no pointer capture -- it has to let a click
   * through to the widget -- so its events go wherever the pointer is: over a
   * neighbour, outside the grid, or onto a child that stops them. None of
   * those reach the widget that was pressed, so it would never see the
   * release, and since only one gesture may be live at a time the grid would
   * then refuse every later drag and resize. The window sees every pointer
   * event, captured or not, which makes it the one place a gesture can always
   * be released from. It is also how a fast drag arms at all: the first move
   * after the press can already be well outside the widget.
   */
  const gestureLive = gesture !== undefined;
  useEffect(() => {
    if (!gestureLive) return undefined;

    const onMove = (event: PointerEvent) => {
      const { current } = live;
      if (!current || current.pointerId !== event.pointerId) return;
      const at = originOf(current);
      const moved = travelled(
        current,
        event.clientX,
        event.clientY,
        at.left,
        at.top,
      );
      // A deferred gesture arms only once the pointer has really travelled.
      const armed =
        current.armed || Math.hypot(moved.dx, moved.dy) >= DRAG_THRESHOLD;
      if (!armed) return;
      if (!current.armed && current.capture.isConnected) {
        // It is a drag after all, so take the pointer from here on. Capturing
        // on the press instead would retarget the release and the click after
        // it, and the widget's own controls would never fire.
        current.capture.setPointerCapture(current.pointerId);
      }
      update({
        ...current,
        ...moved,
        lastX: event.clientX,
        lastY: event.clientY,
        armed,
      });
    };

    /**
     * Scrolling moves the content under a still pointer, so the widget has
     * travelled even though no pointer event fires. The release folds that in,
     * so without this the drop would land somewhere the preview never showed.
     *
     * Only an armed gesture follows it: a press held while the user scrolls is
     * not a drag, and arming on scroll alone would move a widget the user only
     * meant to scroll past.
     */
    const onScroll = () => {
      const { current } = live;
      if (!current || !current.armed) return;
      const at = originOf(current);
      update({
        ...current,
        ...travelled(current, current.lastX, current.lastY, at.left, at.top),
      });
    };

    const onUp = (event: PointerEvent) => {
      const { current } = live;
      if (!current || current.pointerId !== event.pointerId) return;
      update(undefined);
      if (!current.armed) return;
      // From the release event's own position: the pointer can travel between
      // the last move event and the release, and the drop belongs where the
      // user let go.
      const at = originOf(current);
      const { dx, dy } = travelled(
        current,
        event.clientX,
        event.clientY,
        at.left,
        at.top,
      );
      commit(
        current.nodeId,
        targetOf(
          current.nodeId,
          current.kind,
          current.origin,
          dx,
          dy,
          current.corner,
        ),
        current.origin,
      );
    };

    // Only the pointer that owns the gesture may cancel it, so a second
    // pointer going away elsewhere doesn't discard this one.
    const onCancel = (event: PointerEvent) => {
      const { current } = live;
      if (!current || current.pointerId !== event.pointerId) return;
      update(undefined);
    };

    // Capture phase, so these run before anything in the document: a widget
    // that stops `pointerup` for its own reasons would otherwise keep the
    // release from ever reaching here.
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    // Capture phase for `scroll` as well, which does not bubble: a listener
    // here still sees a scroll on any element on its way down.
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [gestureLive, commit, targetOf, update]);

  // A gesture whose node stops being placeable, or that editing has stopped
  // allowing, can never be released by its own handle: that handle is gone,
  // so its up and cancel events never fire. Without this the gesture would
  // persist, leaving the drop preview on screen and -- because only one
  // gesture may be live at a time -- blocking every later drag and resize.
  useEffect(() => {
    const { current } = live;
    if (!current) return;
    // `childIds` as well as `placements`: placements are canvas-wide, so a
    // node moved into another container is still placed, just not here -- and
    // its handle has unmounted, so it can never release the gesture itself.
    if (
      !editable ||
      !placements[current.nodeId] ||
      !childIds.includes(current.nodeId)
    ) {
      update(undefined);
    }
  }, [editable, placements, childIds, update]);

  /**
   * Arrow keys do what dragging that handle does, one cell at a time, so the
   * layout is reachable without a pointer: the grip moves the widget, the
   * resize corner resizes it.
   */
  const onKeyDown =
    (nodeId: string, kind: GestureKind, corner: ResizeCorner = 'se') =>
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const steps: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const step = steps[event.key];
      if (!step) return;
      event.preventDefault();
      const placement = placements[nodeId];
      if (!placement) return;
      const delta = { cols: step[0], rows: step[1] };
      commit(
        nodeId,
        kind === 'move'
          ? movedPlacement(placement, delta, columns)
          : resizedPlacement(
              placement,
              delta,
              columns,
              constraints[nodeId],
              corner,
            ),
        placement,
      );
    };

  const preview = gesture?.armed
    ? targetOf(
        gesture.nodeId,
        gesture.kind,
        gesture.origin,
        gesture.dx,
        gesture.dy,
        gesture.corner,
      )
    : undefined;
  // Where every widget sits for the layout being previewed. Runs the same
  // rules the server will apply on the drop, so the neighbours move aside
  // under the pointer and nothing jumps once the write lands.
  const shown =
    preview && gesture
      ? previewGrid(
          childIds,
          layouts,
          placements,
          gesture.nodeId,
          preview,
          columns,
        )
      : placements;

  return (
    <Grid
      ref={gridRef}
      columns={columns}
      gap={gap}
      rowUnit={rowUnit}
      data-test="canvas-grid-surface"
    >
      {preview && gesture && !samePlacement(preview, gesture.origin) && (
        <DropPreview placement={preview} data-test="canvas-drop-preview" />
      )}
      {childIds.map(childId => {
        const dragging = gesture?.armed && gesture.nodeId === childId;
        // Neighbours follow the previewed layout, so they move aside while
        // the pointer is still down. The widget being dragged stays anchored
        // where it was grabbed, and the pointer offset below moves it.
        const placed = dragging ? placements[childId] : shown[childId];
        // Rows plus the gaps between them: how tall this widget renders.
        const extent = placed
          ? placed.rowSpan * rowUnit + (placed.rowSpan - 1) * gap
          : 0;
        return (
          <GridItem
            key={childId}
            placement={dragging && gesture ? gesture.origin : placed}
            dragging={dragging && gesture?.kind === 'move'}
            data-dragging={dragging ? 'true' : undefined}
            offset={dragging ? { x: gesture.dx, y: gesture.dy } : undefined}
            data-test="canvas-node"
            data-node-id={childId}
          >
            <Interactive
              className="canvas-interactive"
              {...(editable && placements[childId]
                ? { onPointerDown: begin(childId, 'move', false) }
                : {})}
            >
              <Content editable={editable}>{renderNode(childId)}</Content>
              {editable && placements[childId] && (
                <>
                  <Grip
                    type="button"
                    depth={depth}
                    extent={extent}
                    className="canvas-handle"
                    aria-label={t('Move widget')}
                    data-test="canvas-drag-handle"
                    onPointerDown={begin(childId, 'move')}
                    onKeyDown={onKeyDown(childId, 'move')}
                  >
                    <Icons.HolderOutlined iconSize="s" />
                  </Grip>
                  {RESIZE_CORNERS.map(corner => (
                    <ResizeCorner
                      key={corner}
                      type="button"
                      corner={corner}
                      depth={depth}
                      extent={extent}
                      className="canvas-handle"
                      aria-label={t(
                        'Resize widget from the %s corner',
                        CORNER_NAMES[corner](),
                      )}
                      data-test="canvas-resize-handle"
                      data-corner={corner}
                      onPointerDown={begin(childId, 'resize', true, corner)}
                      onKeyDown={onKeyDown(childId, 'resize', corner)}
                    />
                  ))}
                </>
              )}
            </Interactive>
          </GridItem>
        );
      })}
    </Grid>
  );
}
