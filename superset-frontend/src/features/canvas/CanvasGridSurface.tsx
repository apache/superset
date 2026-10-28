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
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components';
import {
  columnWidth,
  GridMetrics,
  gridDelta,
  movedPlacement,
  NO_DELTA,
  placementAt,
  RESIZE_CORNERS,
  type ResizeCorner,
  resizedPlacement,
  samePlacement,
} from './gridGeometry';
import {
  insertIndex,
  previewGrid,
  resolveGrid,
  swapPartner,
  swapped,
} from './resolveGrid';
import { useCanvasDrag } from './useCanvasDrag';
import { CanvasWidgetChromeContext } from './widgetChrome';
import type { GridLayout, GridPlacement, SpanConstraints } from './types';

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
  /**
   * Where inside the widget it was grabbed, in pixels. A drop into another
   * grid lands the widget relative to this, so it keeps its hold on the
   * pointer instead of jumping its own corner under it.
   */
  grabX: number;
  grabY: number;
  /** For a resize, the corner being dragged; the opposite one stays put. */
  corner: ResizeCorner;
  /** The grid's height when it was grabbed; see `Grid`'s `heldHeight`. */
  heldHeight: number;
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

const Grid = styled.div<GridMetrics & { heldHeight?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ columns }) => columns}, minmax(0, 1fr));
  grid-auto-rows: ${({ rowUnit }) => rowUnit}px;
  gap: ${({ gap }) => gap}px;
  /*
   * Held at the height it had when the gesture started, for as long as the
   * gesture lasts.
   *
   * The preview reflows the grid on every move, and dragging a widget up can
   * leave it needing fewer rows. Shrinking it while the view is scrolled near
   * the bottom makes the browser clamp the scroll position, which slides the
   * content under a still pointer -- and since travel is measured against the
   * grid's own position, that feeds straight back into the preview, which
   * reflows again. The result is a drag that fights the user, visible as the
   * page scrolling by itself. A floor costs nothing: the grid may still grow,
   * which is what dragging past the end needs.
   */
  ${({ heldHeight }) =>
    heldHeight &&
    `
    min-height: ${heldHeight}px;
    /*
     * And the browser keeps its hands off the scroll position.
     *
     * Scroll anchoring adjusts scrollTop when content above the viewport
     * changes size, to hold the visible part steady. Dragging a widget
     * upwards reorders everything above it on every move, so the browser
     * corrects the scroll, which moves the grid, which is what travel is
     * measured against -- so the preview moves, which reflows again. The
     * drag runs away on its own, and only once the target is off-screen,
     * because that is when there is anything above to anchor to.
     */
    overflow-anchor: none;
  `}
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
const Interactive = styled.div<{ showBounds?: boolean }>`
  ${({ theme, showBounds }) => css`
    height: 100%;
    position: relative;
    border-radius: ${theme.borderRadius}px;
    transition: box-shadow ${theme.motionDurationMid};

    ${
      showBounds &&
      css`
        /*
       * Every widget shows its edges while a drag is running, containers
       * included. A drop target you cannot see is one you cannot aim at, and
       * revealing a widget only once the pointer is near it tells you where
       * it is just as you arrive.
       */
        box-shadow: 0 0 0 1px ${theme.colorBorderSecondary};
      `
    }

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

    /* A widget's own chrome appears on the same terms as the handles, and
       stays while its menu is open. */
    & > .canvas-chrome {
      opacity: 0;
      transition: opacity ${theme.motionDurationMid};
    }

    &:hover:not(:has(.canvas-interactive:hover)) > .canvas-chrome,
    & > .canvas-chrome:focus-within,
    & > .canvas-chrome:has(.ant-dropdown-open) {
      opacity: 1;
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
 * Where a widget's top-right controls sit: the grip, and the menu beside it.
 *
 * Flush with the top on the root grid, where the resize corners are too.
 * Nested, it steps down to clear the controls of the container around it --
 * a container's box begins where its first child's does, and the child's
 * paint above, so sharing the spot makes the container unreachable.
 */
export const handleTop = (
  sizeUnit: number,
  depth: number,
  extent: number,
): number => (depth === 0 ? 0 : handleOffset(sizeUnit, depth, extent));

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
    /*
     * A stacking context of its own, so a widget's internal layering stays
     * inside it rather than competing with the canvas. An antd table's
     * sticky header sits at columns * 2 + 3 -- nine for three columns, and
     * higher with every column it gains -- so it would otherwise paint over
     * the handles and the drop outline, which sit at 3 and 1 and cannot
     * outbid a number with no ceiling. Isolated, the header can only reach
     * the top of this box.
     */
    isolation: isolate;
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
         * While a widget inside this one is being *moved*, stop clipping. A
         * child dragged towards the edge of its container is leaving the
         * container's box, and scrolling it back into view is the opposite of
         * what the gesture means -- it would cut the widget off at the edge
         * and grow a scrollbar. Only an ancestor matches: the dragged widget's
         * own content does not contain its grid cell.
         *
         * A resize is not a move: the widget stays inside its container, so
         * unclipping gains nothing and costs plenty. Dropping the clip makes
         * every scrolling widget inside render at its full height for the
         * length of the gesture, which for a table means its rows -- and its
         * sticky header -- spilling out over whatever is below.
         */
        &:has([data-dragging='true']) {
          overflow: visible;
        }
      `
    }
  `}
`;

/**
 * Where a widget's own controls go: over the widget, outside the box its
 * content scrolls in.
 *
 * Transparent to the pointer, so it does not shadow the widget beneath it;
 * what it holds takes presses for itself.
 */
const Chrome = styled.div<{ offset: number }>`
  ${({ theme, offset }) => css`
    position: absolute;
    inset: 0;
    pointer-events: none;

    .canvas-widget-controls {
      position: absolute;
      /*
       * The same step down the handles take, so the controls stay level with
       * the grip at every depth. Nested, the grip moves clear of the grip of
       * the container around it; leaving the menu behind splits what should
       * read as one row.
       */
      top: ${offset}px;
      /*
       * Clear of the widget's right edge, where both the resize handle and a
       * scrollbar live. See WithQuery, which uses the same inset when it
       * renders in place.
       */
      right: ${theme.sizeUnit * 5}px;
      pointer-events: auto;
    }
  `}
`;

/**
 * A widget's content, and the node its chrome renders into.
 *
 * The two are siblings so chrome escapes the content's scrolling, clipping
 * and stacking; see `CanvasWidgetChromeContext`.
 */
function WidgetBody({
  editable,
  offset,
  children,
}: {
  editable: boolean;
  /** Where the handles sit, so the chrome can sit level with them. */
  offset: number;
  children: ReactNode;
}) {
  const [chrome, setChrome] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <Content editable={editable}>
        <CanvasWidgetChromeContext.Provider value={chrome}>
          {children}
        </CanvasWidgetChromeContext.Provider>
      </Content>
      <Chrome ref={setChrome} className="canvas-chrome" offset={offset} />
    </>
  );
}

const Grip = styled.button<{ depth: number; extent: number }>`
  ${({ theme, depth, extent }) => css`
    position: absolute;
    /*
     * On the root grid the grip sits flush with the top, where the widget's
     * own controls and the resize corners already are, so the three read as
     * one row. Nested, it steps down to clear the grip of the widget inside
     * it -- a container's box begins where its first child's does, and the
     * child's grip paints above, so sharing the spot makes the container
     * ungrabbable.
     */
    top: ${handleTop(theme.sizeUnit, depth, extent)}px;
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
    /* The same box as the controls button beside it, so the two line up. */
    width: ${theme.sizeUnit * 8}px;
    height: ${theme.sizeUnit * 8}px;
    padding: 0;
    border: none;
    background: none;
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
  /** The container this grid lays out; the root grid's own id for the root. */
  parentId: string;
  onPlace: (nodeId: string, placement: GridPlacement) => void;
  /**
   * Persist two widgets exchanging places, which is what a drop landing
   * squarely on one widget does.
   */
  onSwap: (
    nodeId: string,
    placement: GridPlacement,
    partnerId: string,
    partnerPlacement: GridPlacement,
  ) => void;
  /**
   * Persist a widget dragged into this grid from another one. `index` is
   * where it belongs in this grid's reading order.
   */
  onMove: (
    nodeId: string,
    parent: string,
    index: number,
    placement: GridPlacement,
  ) => void;
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
  parentId,
  onPlace,
  onSwap,
  onMove,
  renderNode,
}: CanvasGridSurfaceProps) {
  const theme = useTheme();
  const drag = useCanvasDrag();
  const [measureGrid, width] = useElementWidth();
  // Registered so a gesture anywhere on the canvas can find this grid under
  // the pointer, and so this one can find the others.
  const [gridNode, setGridNode] = useState<HTMLDivElement | null>(null);
  // Read by another grid's drag, so it has to be current without this grid
  // re-registering on every render.
  const contents = useRef({ childIds, layouts });
  contents.current = { childIds, layouts };
  const snapshot = useCallback(() => contents.current, []);
  useEffect(() => {
    if (!gridNode) return undefined;
    return drag.register({
      parentId,
      element: gridNode,
      columns,
      gap,
      rowUnit,
      depth,
      snapshot,
    });
  }, [drag, gridNode, parentId, columns, gap, rowUnit, depth, snapshot]);

  // The grid node, for reading where it sits in the viewport mid-gesture.
  const grid = useRef<HTMLDivElement | null>(null);
  const gridRef = useCallback(
    (node: HTMLDivElement | null) => {
      grid.current = node;
      setGridNode(node);
      measureGrid(node);
    },
    [measureGrid],
  );

  /**
   * Where the dragged widget would land in another grid, when the pointer is
   * over one.
   *
   * A drag only sends `place` while the widget stays put, so without this a
   * widget cannot leave its container -- dropping a tile below its group just
   * grows the group. The destination is whichever grid is under the pointer,
   * and the landing is computed in *its* units: the origin the gesture
   * started from means nothing there.
   */
  const landingFor = useCallback(
    (current: Gesture, clientX: number, clientY: number) => {
      if (current.kind !== 'move') return undefined;
      const hit = drag.gridAt(clientX, clientY);
      const over = hit?.grid;
      if (!hit || !over || over.parentId === parentId) return undefined;
      const metrics: GridMetrics = {
        columns: over.columns,
        gap: over.gap,
        rowUnit: over.rowUnit,
      };
      // Placed against the same box it was found by, so detection and the
      // drop cannot disagree about where the grid is.
      const placement = placementAt(
        clientX,
        clientY,
        current.grabX,
        current.grabY,
        { left: hit.left, top: hit.top, width: hit.width },
        metrics,
        current.origin,
        columns,
      );
      // Its place in the destination's reading order, by the rule the server
      // applies on the drop.
      const there = over.snapshot();
      const resolved = resolveGrid(
        there.childIds.map(id => there.layouts[id] ?? {}),
        over.columns,
      );
      return {
        nodeId: current.nodeId,
        parentId: over.parentId,
        placement,
        index: insertIndex(resolved, placement),
      };
    },
    [drag, parentId],
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
    (
      nodeId: string,
      next: GridPlacement | undefined,
      from: GridPlacement,
      kind: GestureKind,
    ) => {
      const placement = placements[nodeId];
      if (!next || !placement) return;
      if (samePlacement(next, from) || samePlacement(next, placement)) return;
      // Landing squarely on one widget exchanges places with it: it takes
      // the slot this one came from. Anything less definite -- empty space,
      // or straddling two -- still pushes the widgets below it down. Only a
      // move: growing a widget over its neighbour is not an offer to trade
      // places with it.
      const partner =
        kind === 'move'
          ? swapPartner(childIds, placements, nodeId, next)
          : undefined;
      if (partner) {
        onSwap(nodeId, next, partner, swapped(placements[partner], from));
        return;
      }
      onPlace(nodeId, next);
    },
    [onPlace, onSwap, placements, childIds],
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
      // Pin where every grid is, before any preview starts moving them: a
      // container has to stay where the user is aiming rather than being
      // pushed along with the rest of its grid. At the press, because a
      // handle gesture is already armed by its first move.
      drag.freeze();
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
        // Measured against where the widget sits in this grid, which is the
        // only place its origin means anything.
        grabX:
          event.clientX -
          ((box?.left ?? 0) +
            (origin.col - 1) *
              (columnWidth(width, { columns, gap, rowUnit }) + gap)),
        grabY:
          event.clientY -
          ((box?.top ?? 0) + (origin.row - 1) * (rowUnit + gap)),
        dx: 0,
        dy: 0,
        lastX: event.clientX,
        lastY: event.clientY,
        origin,
        armed,
        capture: event.currentTarget,
        corner,
        heldHeight: grid.current?.offsetHeight ?? 0,
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

    const onPointerMove = (event: PointerEvent) => {
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
      /*
       * A deferred gesture arms only once the *pointer* has really travelled.
       *
       * Measured from where the press landed, not from `moved`, which folds
       * in how far the content has scrolled since. Holding a widget and
       * wheel-scrolling a few rows without moving the hand would otherwise
       * put the threshold behind you, so the next pixel of pointer movement
       * arms a drag the user never began -- and releasing writes it.
       */
      const armed =
        current.armed ||
        Math.hypot(
          event.clientX - current.startX,
          event.clientY - current.startY,
        ) >= DRAG_THRESHOLD;
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
      // Over another grid? Then that grid shows the drop, and this one
      // reflows as though the widget had already left.
      drag.setLanding(landingFor(current, event.clientX, event.clientY));
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
      // Where it landed, from the release event's own position: the pointer
      // can travel between the last move and the release, and the drop
      // belongs where the user let go.
      const landed = current.armed
        ? landingFor(current, event.clientX, event.clientY)
        : undefined;
      drag.setLanding(undefined);
      drag.release();
      if (!current.armed) return;
      if (landed) {
        // It left its container, which the server takes as a different
        // operation: the layout alone cannot say where a widget now lives.
        onMove(landed.nodeId, landed.parentId, landed.index, landed.placement);
        return;
      }
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
        current.kind,
      );
    };

    // Only the pointer that owns the gesture may cancel it, so a second
    // pointer going away elsewhere doesn't discard this one.
    const onCancel = (event: PointerEvent) => {
      const { current } = live;
      if (!current || current.pointerId !== event.pointerId) return;
      update(undefined);
      drag.setLanding(undefined);
      drag.release();
    };

    // Capture phase, so these run before anything in the document: a widget
    // that stops `pointerup` for its own reasons would otherwise keep the
    // release from ever reaching here.
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    // Capture phase for `scroll` as well, which does not bubble: a listener
    // here still sees a scroll on any element on its way down.
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [gestureLive, commit, targetOf, update, drag, landingFor, onMove]);

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
        kind,
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
  // A drag that has wandered into another grid. The one it came from shows
  // the widget gone; the one under the pointer shows it arriving.
  const { landing } = drag;
  const leaving = Boolean(gesture?.armed && landing?.nodeId === gesture.nodeId);
  const arriving = landing?.parentId === parentId ? landing : undefined;

  // Where every widget sits for the layout being previewed. Runs the same
  // rules the server will apply on the drop, so the neighbours move aside
  // under the pointer and nothing jumps once the write lands.
  const shown = (() => {
    if (arriving) {
      // Resolved with the incoming widget in place, so this grid's children
      // make room for it before the drop rather than after.
      const withIt = [...childIds];
      withIt.splice(arriving.index, 0, arriving.nodeId);
      return previewGrid(
        withIt,
        { ...layouts, [arriving.nodeId]: arriving.placement },
        placements,
        arriving.nodeId,
        arriving.placement,
        columns,
      );
    }
    if (leaving) {
      // Resolved without it: it belongs to another grid now.
      const without = childIds.filter(id => id !== gesture?.nodeId);
      const resolved = resolveGrid(
        without.map(id => layouts[id] ?? {}),
        columns,
      );
      return Object.fromEntries(
        without.map((id, index) => [id, resolved[index]]),
      );
    }
    if (!preview || !gesture) return placements;
    // Landing on one widget shows the exchange, so the drop matches what was
    // on screen a moment before it.
    const partner = swapPartner(childIds, placements, gesture.nodeId, preview);
    if (partner) {
      return {
        ...placements,
        [gesture.nodeId]: preview,
        [partner]: swapped(placements[partner], gesture.origin),
      };
    }
    return previewGrid(
      childIds,
      layouts,
      placements,
      gesture.nodeId,
      preview,
      columns,
    );
  })();

  return (
    <Grid
      ref={gridRef}
      columns={columns}
      gap={gap}
      rowUnit={rowUnit}
      heldHeight={gesture?.heldHeight}
      data-test="canvas-grid-surface"
    >
      {/* The widget is arriving from another grid: show where it lands. */}
      {arriving && (
        <DropPreview
          placement={arriving.placement}
          data-test="canvas-drop-preview"
        />
      )}
      {/* Its own drag, as long as it has not wandered off to another grid. */}
      {!leaving &&
        preview &&
        gesture &&
        !samePlacement(preview, gesture.origin) && (
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
            data-dragging={
              dragging && gesture?.kind === 'move' ? 'true' : undefined
            }
            offset={dragging ? { x: gesture.dx, y: gesture.dy } : undefined}
            data-test="canvas-node"
            data-node-id={childId}
          >
            <Interactive
              className="canvas-interactive"
              showBounds={drag.dragging}
              {...(editable && placements[childId]
                ? { onPointerDown: begin(childId, 'move', false) }
                : {})}
            >
              <WidgetBody
                editable={editable}
                offset={handleTop(theme.sizeUnit, depth, extent)}
              >
                {renderNode(childId)}
              </WidgetBody>
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
