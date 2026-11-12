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
 * While a move is live the widget follows the pointer and a dashed outline
 * marks the cells it would take. A resize has no outline: the widget itself
 * takes the size, so the answer is the thing being pointed at. Either way,
 * releasing persists exactly what was shown.
 *
 * What a drop *means* is not decided here. `dragStates.ts` reads the gesture
 * -- a plain drop, a trade of places, or nothing -- and settles the grid for
 * its answer; this file asks it the same question while the pointer moves and
 * again on release, which is what makes the second sentence above true rather
 * than merely intended.
 */

import {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components';
import {
  columnWidth,
  exactDelta,
  GridMetrics,
  type GridDelta,
  gridDelta,
  gridPitch,
  movedPlacement,
  NO_DELTA,
  placementAt,
  RESIZE_CORNERS,
  type ResizeCorner,
  resizedPlacement,
  samePlacement,
} from './gridGeometry';
import { insertIndex, resolveGrid } from './resolveGrid';
import {
  type Aim,
  changesAnything,
  chooseDrop,
  type GridState,
  resolve,
} from './dragStates';
import { useCanvasDrag } from './useCanvasDrag';
import { CanvasWidgetChromeContext } from './widgetChrome';
import { useCanvasSelection } from './useCanvasSelection';
import type {
  GestureKind,
  GridLayout,
  GridPlacement,
  SpanConstraints,
} from './types';

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

/** What each arrow key asks for, in whole cells. */
const ARROW_STEPS: Record<string, GridDelta> = {
  ArrowLeft: { cols: -1, rows: 0 },
  ArrowRight: { cols: 1, rows: 0 },
  ArrowUp: { cols: 0, rows: -1 },
  ArrowDown: { cols: 0, rows: 1 },
};

/**
 * Presses already claimed by a grid, so one that bubbles through nested grids
 * starts exactly one gesture: the innermost grid's.
 */
const claimedPresses = new WeakSet<Event>();

/**
 * Controls whose press and whose click are both their own: a form control, a
 * slider, a link, a button. Pressing one is about the control, and so is
 * clicking it -- neither moves the widget holding it, and neither selects it.
 */
const CONTROLS = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[role="slider"]',
  /*
   * A button inside the widget, but never the widget's own press surface,
   * which is itself a button so it can be selected and reached by keyboard.
   * `closest` would match it from any press within it -- and `contains`
   * counts an element as containing itself -- so without the exclusion every
   * press on a body would be read as a control's and body drag would quietly
   * stop working, leaving only the handles.
   */
  '[role="button"]:not([data-canvas-selectable])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="scrollbar"]',
];

/** A control's click is its own, so it is not also a selection. */
const OWN_CLICK = CONTROLS.join(',');

/**
 * What a press must not be read as a drag on, which is the controls plus two
 * more: something the page itself drags, and anything a widget has opted out
 * with `data-canvas-no-drag`.
 *
 * Wider than `OWN_CLICK` on purpose. A chart marks itself, because its click
 * target is a pixel on a canvas element with nothing for a selector to match
 * -- but its body *is* the whole widget, so if the marker also stopped it
 * being selected there would be nowhere left to click. A widget that means to
 * consume the click as well stops the click itself.
 */
const OWN_GESTURE = [
  ...CONTROLS,
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

/**
 * Whether something inside the widget owns this event, so the grid doesn't.
 *
 * `selector` says which question is being asked: `OWN_GESTURE` for a press
 * that must not become a drag, `OWN_CLICK` for a click that must not become a
 * selection. They are not the same set.
 */
const ownedBy = (
  event: ReactMouseEvent<HTMLElement>,
  selector: string,
): boolean => {
  const { target } = event;
  if (!(target instanceof Element)) return false;
  const owner = target.closest(selector);
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

/**
 * What an empty container shows instead of nothing.
 *
 * A container with no children is a box of blank space: it accepts a drop
 * anywhere inside it, and says so nowhere. Absolute rather than a grid cell,
 * so it covers the container's whole area however many rows that is.
 */
const EmptyDrop = styled.div<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.borderRadius}px;
    border: 1px dashed
      ${$active ? theme.colorPrimary : theme.colorBorderSecondary};
    background: ${$active ? theme.colorPrimaryBg : 'transparent'};
    color: ${$active ? theme.colorPrimary : theme.colorTextTertiary};
    transition: background ${theme.motionDurationMid};
  `}
`;

const Grid = styled.div<GridMetrics & { heldHeight?: number; $fill?: boolean }>`
  display: grid;
  /* So an empty container's invitation can cover it. Safe: the handles and a
     widget's controls anchor to their own cell, which is positioned. */
  position: relative;
  /*
   * Inside a container, the grid takes the room the container has left after
   * its own chrome, rather than only the rows its children fill. That is what
   * makes the empty space below them part of the grid -- to drop into, and to
   * measure the real row count from.
   */
  ${({ $fill }) => $fill && 'flex: 1 1 auto; min-height: 0;'}
  grid-template-columns: repeat(${({ columns }) => columns}, minmax(0, 1fr));
  grid-auto-rows: ${({ rowUnit }) => rowUnit}px;
  gap: ${({ gap }) => gap}px;
  /*
   * One row of this grid, gap included: what a container that draws chrome
   * above its grid has to fit that chrome into.
   *
   * The server keeps exactly this much room for it: chrome_rows grows the
   * container by a row (_fit, validation.py) -- and the container clips, so
   * chrome any taller than this cuts the bottom off the grid's last row. The
   * two numbers have to be the same number, so the chrome reads it from here
   * rather than being given a constant that a change to either of these, or
   * to the heading's own type scale, would quietly invalidate.
   */
  --canvas-chrome-rows: ${({ rowUnit, gap }) => rowUnit + gap}px;
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
const Interactive = styled.div<{
  showBounds?: boolean;
  $destination?: boolean;
}>`
  ${({ theme, showBounds, $destination }) => css`
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
       *
       * The container the widget would land in says so louder: "where could
       * this go" and "where is it going" are different questions, and the
       * second one has one answer.
       */
        box-shadow: ${
          $destination
            ? `0 0 0 2px ${theme.colorPrimary}`
            : `0 0 0 1px ${theme.colorBorderSecondary}`
        };
      `
    }

    /*
     * Selected is the same as hovered, for as long as it is selected: the
     * grip, the four corners and the widget's own controls stay where they
     * can be seen and aimed at, rather than only while the pointer happens
     * to be over them.
     */
    &[aria-pressed='true'] > .canvas-handle {
      opacity: 1;
      pointer-events: auto;
    }

    /* Chrome is only made visible, never clickable as a whole: the layer is
       transparent to the pointer on purpose, and what it holds takes its own
       presses. */
    &[aria-pressed='true'] > .canvas-chrome {
      opacity: 1;
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
 * Whether a widget's handles have a container's handles to clear.
 *
 * Only the child sitting under them does. A container's grip is at the top
 * left of its box, and a bare container's box begins where its first row of
 * children does -- so a child in that row, starting at the container's first
 * column, would paint over it and make the container ungrabbable. Every other
 * child has nothing to clear, and stepping it down would strand its handles in
 * the middle of the widget for no reason.
 *
 * Only the grip, because only the grip is on that side: a widget's own
 * controls and its remove button are on the right, and containers render
 * neither.
 *
 * `chromeAbove` says the container draws something of its own over that strip,
 * such as a group's title. Its handles then sit in that chrome rather than on
 * its first row, so no child has anything to clear and none steps down.
 */
export const stepsAside = (
  depth: number,
  placement: { row: number; col: number } | undefined,
  chromeAbove = false,
): boolean =>
  !chromeAbove &&
  depth > 0 &&
  placement !== undefined &&
  placement.row === 1 &&
  placement.col === 1;

/**
 * Where a widget's top-right controls sit: the grip, and the menu beside it.
 *
 * Flush with the top unless they have a container's to clear, in which case
 * they step down far enough to leave a whole handle's worth of room.
 */
export const handleTop = (
  sizeUnit: number,
  depth: number,
  extent: number,
  stepped = true,
): number =>
  depth === 0 || !stepped ? 0 : handleOffset(sizeUnit, depth, extent);

/**
 * The widget itself, kept inside the cells it was given.
 *
 * A widget renders at its natural height — a table with every row, say — so
 * without this it spills past its own box and over whatever is below. The
 * handles are siblings rather than children, so they stay pinned to the box
 * while the content scrolls behind them.
 */
const Content = styled.div<{ editable: boolean; overflow: string }>`
  ${({ editable, overflow }) => css`
    height: 100%;
    overflow: ${overflow};
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
 * What a widget's box does with anything that does not fit.
 *
 * An ordinary widget renders at its natural height -- a table with every row
 * -- and scrolls. A container does not: what it holds is placed in its own
 * grid, bounded by the container's rows, so there is nothing below to scroll
 * to, and a scrollbar inside a group reads as a widget with more in it, which
 * is never true. While a drag is running it does not clip either: a widget on
 * its way out of a container is over it, not in it, and cutting it in half at
 * the border hides the thing being aimed.
 */
export const overflowFor = (container: boolean, dragging: boolean): string => {
  if (!container) return 'auto';
  return dragging ? 'visible' : 'hidden';
};

/**
 * A widget's content, and the node its chrome renders into.
 *
 * The two are siblings so chrome escapes the content's scrolling, clipping
 * and stacking; see `CanvasWidgetChromeContext`.
 */
function WidgetBody({
  editable,
  offset,
  overflow,
  children,
}: {
  editable: boolean;
  /** Where the handles sit, so the chrome can sit level with them. */
  offset: number;
  /** How this widget's box treats what does not fit; see `overflowFor`. */
  overflow: string;
  children: ReactNode;
}) {
  const [chrome, setChrome] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <Content editable={editable} overflow={overflow}>
        <CanvasWidgetChromeContext.Provider value={chrome}>
          {children}
        </CanvasWidgetChromeContext.Provider>
      </Content>
      <Chrome ref={setChrome} className="canvas-chrome" offset={offset} />
    </>
  );
}

/**
 * The mark on the selected widget.
 *
 * A sibling of the content rather than an outline on the box around it: the
 * content sets `isolation: isolate`, so anything it stacks internally paints
 * after its parent's outline, and a chart's canvas or a table's sticky header
 * would draw straight over it. An inset shadow takes no space, so selecting a
 * widget moves nothing on screen.
 */
const Selected = styled.div<{ depth: number }>`
  ${({ theme, depth }) => css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: ${theme.borderRadius}px;
    box-shadow: inset 0 0 0 2px ${theme.colorPrimary};
    /* The same ladder the handles climb, so the innermost selection wins a
       shared edge. */
    z-index: ${3 + depth};
  `}
`;

/**
 * Takes a widget off the canvas.
 *
 * Beside the widget's own controls rather than with the grip: the grip is the
 * one thing on the left, and a destructive control sitting under the pointer
 * on the way to it would be too easy to hit. No confirmation, because the
 * change is only in the draft and Undo in the banner reverses it.
 */
const Remove = styled.button<{ depth: number; offset: number }>`
  ${({ theme, depth, offset }) => css`
    position: absolute;
    top: ${offset}px;
    z-index: ${3 + depth};
    /* Left of the widget's own controls, which are 8 units wide at 5. */
    right: ${theme.sizeUnit * 13}px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 8}px;
    height: ${theme.sizeUnit * 8}px;
    padding: 0;
    border: none;
    background: none;
    color: ${theme.colorTextSecondary};
    cursor: pointer;

    &:hover {
      color: ${theme.colorError};
    }
  `}
`;

const Grip = styled.button<{ depth: number; offset: number }>`
  ${({ theme, depth, offset }) => css`
    position: absolute;
    /* Flush with the top, beside the widget's own controls and the resize
       corners, unless it has a container's grip to clear; see stepsAside. */
    top: ${offset}px;
    /* Deeper handles above shallower ones: the innermost wins a shared spot. */
    z-index: ${3 + depth};
    /*
     * Right of the north-west resize corner, which is 4 units at the corner.
     * Nothing else lives on this side: a widget's own controls and its remove
     * button are both on the right, so the grip only has the corner to clear.
     */
    left: ${theme.sizeUnit * 4}px;
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
        border-${west ? 'left' : 'right'}: 2px solid ${theme.colorIcon};
        border-${north ? 'top' : 'bottom'}: 2px solid ${theme.colorIcon};
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
  /**
   * Whether the container around this grid draws chrome of its own above it,
   * such as a title; see `stepsAside`.
   */
  chromeAbove?: boolean;
  /** The container this grid lays out; the root grid's own id for the root. */
  parentId: string;
  /** Whether a child holds a grid of its own, and so is bounded, not scrolled. */
  isContainer?: (nodeId: string) => boolean;
  /** What to call a widget out loud, for the selection's accessible name. */
  labelOf?: (nodeId: string) => string;
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
  /** Takes a widget off the canvas. */
  onRemove: (nodeId: string) => void;
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
  chromeAbove = false,
  parentId,
  isContainer = () => false,
  labelOf = nodeId => nodeId,
  onPlace,
  onSwap,
  onMove,
  onRemove,
  renderNode,
}: CanvasGridSurfaceProps) {
  const theme = useTheme();
  const drag = useCanvasDrag();
  const selection = useCanvasSelection();
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
      // The container this grid fills, whose box is the whole of what counts
      // as "inside" it. The root grid has no container and is its own.
      bounds:
        gridNode.closest<HTMLElement>('[data-test="canvas-node"]') ?? gridNode,
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
      // Not into itself: a container dragged across its own footprint is
      // still over its own grid, and asking the server to make it its own
      // child is refused -- taking an otherwise valid reposition with it.
      const hit = drag.gridAt(clientX, clientY, current.nodeId);
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
   * Where the widget is actually being held: `from` plus the pointer delta in
   * grid units, unrounded.
   *
   * `targetOf` rounds, because a layout is whole cells. This does not, so
   * `chooseDrop` can tell two readings of the drop apart by how near each
   * leaves the widget to the hand -- a decision the rounding would have made
   * first, and worse.
   */
  const aimAt = useCallback(
    (from: GridPlacement, dx: number, dy: number): Aim => {
      const metrics: GridMetrics = { columns, gap, rowUnit };
      const exact = exactDelta(dx, dy, width, metrics);
      const pitch = gridPitch(width, metrics);
      return {
        col: from.col + exact.cols,
        row: from.row + exact.rows,
        colPitch: pitch.col,
        rowPitch: pitch.row,
      };
    },
    [width, columns, gap, rowUnit],
  );

  /**
   * The reading the drop had a moment ago, for `select` to be sticky about.
   *
   * A ref, and written after the render that chose it: it is an input to the
   * next choice rather than something to re-render for, and putting it in
   * state would make every pointer move render twice to reach the same
   * answer. Cleared whenever no gesture is armed, so a new drag starts with
   * no history -- the previous one's reading has nothing to say about it.
   */
  const heldDrop = useRef<string>();

  /** The grid as the drop rules need to see it. */
  const gridState: GridState = useMemo(
    () => ({ childIds, layouts, placements, columns }),
    [childIds, layouts, placements, columns],
  );

  /**
   * Persists the drop of `nodeId` aimed at `aim` and snapped to `snap`, where
   * `origin` is the placement the gesture resolved against.
   *
   * What the drop *means* is not decided here: `chooseDrop` decides it, and
   * the preview asks it the same question with the same inputs, which is what
   * keeps the two from disagreeing. All that is left is sending the reading it
   * returned.
   */
  const commit = useCallback(
    (
      nodeId: string,
      kind: GestureKind,
      origin: GridPlacement,
      snap: GridPlacement | undefined,
      aim: Aim,
      held?: string,
    ) => {
      const placement = placements[nodeId];
      if (!snap || !placement) return;
      // `held` as well, so the release honours the stickiness the preview was
      // showing. Without it a drop sitting inside the sticky band would write
      // the cell the pointer is nearest rather than the one on screen -- the
      // one disagreement this whole arrangement exists to rule out.
      const chosen = chooseDrop(gridState, nodeId, kind, snap, aim, held);
      // Both no-op checks inside `changesAnything` matter. A gesture that
      // moved nothing resolves back to `origin`, and sending that would write
      // the geometry the widget had when it was grabbed over anything that
      // landed while the button was held -- a plain click on a handle would
      // revert a draft poll or another editor's resize. Comparing with the
      // current placement then drops a gesture that happens to land exactly
      // where the widget already sits.
      if (!chosen || !changesAnything(chosen, origin, placement)) return;
      const { drop } = chosen;
      if (drop.kind === 'swap' && drop.partner) {
        // Both halves of the exchange, where the grid settled them -- so the
        // drop holds still instead of jumping while the write is in flight.
        onSwap(
          nodeId,
          chosen.placements[nodeId],
          drop.partner,
          chosen.placements[drop.partner],
        );
        return;
      }
      onPlace(nodeId, drop.target);
    },
    [onPlace, onSwap, placements, gridState],
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
      if (!armed && ownedBy(event, OWN_GESTURE)) return;
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
      // pushed along with the rest of its grid. At the press, because that is
      // the last moment the targets are where the user aimed.
      drag.freeze();
      // A handle press is a drag from the start; a press on the body is a
      // click until it travels, and says so at the threshold instead.
      if (armed) drag.arm();
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
      if (!current.armed) {
        // It is a drag after all. The canvas is told here rather than at the
        // press, so a plain click does not flash every widget's edges.
        drag.arm();
        if (current.capture.isConnected) {
          // Take the pointer from here on. Capturing on the press instead
          // would retarget the release and the click after it, and the
          // widget's own controls would never fire.
          current.capture.setPointerCapture(current.pointerId);
        }
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
        current.kind,
        current.origin,
        targetOf(
          current.nodeId,
          current.kind,
          current.origin,
          dx,
          dy,
          current.corner,
        ),
        aimAt(current.origin, dx, dy),
        heldDrop.current,
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
  }, [gestureLive, commit, targetOf, aimAt, update, drag, landingFor, onMove]);

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
   * One cell of movement or resizing, as a key press asks for it.
   *
   * The same clamping a drag goes through, so a nudge can no more produce a
   * layout the server rejects than a drop can. Shared by the handles and by
   * the selection, which both offer the arrow keys.
   */
  const nudge = useCallback(
    (
      nodeId: string,
      kind: GestureKind,
      corner: ResizeCorner,
      delta: GridDelta,
    ) => {
      const placement = placements[nodeId];
      if (!placement) return;
      const target =
        kind === 'move'
          ? movedPlacement(placement, delta, columns)
          : resizedPlacement(
              placement,
              delta,
              columns,
              constraints[nodeId],
              corner,
            );
      // A key press aims at exactly one cell, so that cell *is* the aim:
      // there is no fraction for the readings to be told apart by, and a
      // nudge onto a neighbour's own slot trades places with it just as a
      // drop there does.
      commit(nodeId, kind, placement, target, aimAt(target, 0, 0));
    },
    [placements, commit, columns, constraints, aimAt],
  );

  /**
   * Clicking a widget selects it.
   *
   * The innermost one: a click inside a group is about the widget it landed
   * on, and the group is selected by clicking its own space instead. A press
   * a control owns selects nothing -- pressing a filter's dropdown is about
   * the filter, not about the widget holding it.
   */
  const selectOnClick =
    (nodeId: string) => (event: ReactMouseEvent<HTMLElement>) => {
      // A widget's modal renders in a portal outside this subtree, and React
      // routes its clicks through here: without this, clicking inside "View
      // query" selects the widget behind it.
      if (
        !(event.target instanceof Node) ||
        !event.currentTarget.contains(event.target)
      ) {
        return;
      }
      if (ownedBy(event, OWN_CLICK)) return;
      event.stopPropagation();
      selection.select(nodeId);
    };

  /**
   * The keyboard on the widget itself: Enter or Space selects, Escape lets
   * go, and once it is selected the arrows move it -- with Shift, resize it.
   *
   * Which means the layout is reachable without first finding a handle that
   * is only 16px across and only appears on hover.
   */
  const keysOnWidget =
    (nodeId: string, selected: boolean) =>
    (event: ReactKeyboardEvent<HTMLElement>) => {
      // Only keys pressed on the widget itself. The handles answer the arrows
      // too and do not stop them bubbling, so without this one press would
      // commit twice; and a widget's own field or dropdown must keep its
      // arrows.
      if (event.target !== event.currentTarget) return;
      // Leaves every shortcut to whoever owns it -- Cmd/Ctrl+Z to the toolbar.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selection.select(nodeId);
        return;
      }
      if (event.key === 'Escape') {
        // Focus stays where it is, so Tab carries on from here.
        event.preventDefault();
        selection.select(undefined);
        return;
      }
      const step = ARROW_STEPS[event.key];
      // Selected, not merely focused: tabbing through a canvas would
      // otherwise rearrange it on the way past.
      if (!step || !selected) return;
      // A nudge resolves against the stored placement while a live gesture
      // resolves against the one it was grabbed at; interleaving them would
      // persist a rectangle nobody saw.
      if (live.current) return;
      // Or the page scrolls under the widget instead.
      event.preventDefault();
      nudge(nodeId, event.shiftKey ? 'resize' : 'move', 'se', step);
    };

  /**
   * Arrow keys do what dragging that handle does, one cell at a time, so the
   * layout is reachable without a pointer: the grip moves the widget, the
   * resize corner resizes it.
   */
  const onKeyDown =
    (nodeId: string, kind: GestureKind, corner: ResizeCorner = 'se') =>
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const step = ARROW_STEPS[event.key];
      if (!step) return;
      event.preventDefault();
      nudge(nodeId, kind, corner, step);
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

  // What the drop would mean as things stand, settled. The release asks
  // `chooseDrop` the same question from the same inputs, so the widgets shown
  // moving aside under the pointer are the ones the write moves: the preview
  // is the write's own answer rather than a second opinion about it.
  const choice =
    gesture?.armed && preview
      ? chooseDrop(
          gridState,
          gesture.nodeId,
          gesture.kind,
          preview,
          aimAt(gesture.origin, gesture.dx, gesture.dy),
          heldDrop.current,
        )
      : undefined;
  const chosen = gesture?.armed ? choice?.drop.id : undefined;
  useEffect(() => {
    heldDrop.current = chosen;
  }, [chosen]);

  // Where every widget sits for the layout being previewed. Runs the same
  // rules the server will apply on the drop, so the neighbours move aside
  // under the pointer and nothing jumps once the write lands.
  const shown = (() => {
    if (arriving) {
      // Settled with the incoming widget in place, so this grid's children
      // make room for it before the drop rather than after. Through the same
      // `resolve` every other reading goes through -- a widget arriving from
      // elsewhere is a `place`, on a grid that has it as a child already.
      const withIt = [...childIds];
      withIt.splice(arriving.index, 0, arriving.nodeId);
      return resolve(
        {
          childIds: withIt,
          layouts: { ...layouts, [arriving.nodeId]: arriving.placement },
          placements,
          columns,
        },
        arriving.nodeId,
        { id: 'place', kind: 'place', target: arriving.placement },
      ).placements;
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
    return choice?.placements ?? placements;
  })();

  return (
    <Grid
      ref={gridRef}
      columns={columns}
      gap={gap}
      rowUnit={rowUnit}
      heldHeight={gesture?.heldHeight}
      $fill={depth > 0}
      // The root grid's own space is the canvas's background: a click that
      // reaches it is a click on nothing, and lets the selection go. Only the
      // root -- a click on a container's empty space is a click on that
      // container, and selects it.
      {...(depth === 0 && editable
        ? {
            onClick: (event: ReactMouseEvent<HTMLElement>) => {
              if (event.target === event.currentTarget) selection.select();
            },
          }
        : {})}
      data-test="canvas-grid-surface"
    >
      {/* Nothing here yet, and nowhere to aim: say where the space is. */}
      {editable && childIds.length === 0 && (
        <EmptyDrop $active={drag.dragging} data-test="canvas-empty-drop">
          {t('Drop a widget here')}
        </EmptyDrop>
      )}
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
        gesture.kind === 'move' &&
        !samePlacement(preview, gesture.origin) && (
          <DropPreview
            // The chosen reading, not the cell the pointer rounds to: with a
            // neighbouring cell in play they can differ, and an outline that
            // showed the rounding would be marking somewhere the drop is not
            // going to go.
            placement={choice?.rect ?? preview}
            data-test="canvas-drop-preview"
          />
        )}
      {childIds.map(childId => {
        const dragging = gesture?.armed && gesture.nodeId === childId;
        // Neighbours follow the previewed layout, so they move aside while
        // the pointer is still down.
        //
        // A widget being *moved* stays in the cells it was grabbed from,
        // because the pointer offset below is what carries it; placing it
        // where it would land as well would move it twice. One being
        // *resized* has no such offset, so it takes the previewed size
        // directly and grows and shrinks under the hand -- which is the
        // thing a resize is asking to see.
        const carried = dragging && gesture?.kind === 'move';
        const placed = carried ? placements[childId] : shown[childId];
        // Rows plus the gaps between them: how tall this widget renders.
        const extent = placed
          ? placed.rowSpan * rowUnit + (placed.rowSpan - 1) * gap
          : 0;
        // One answer for the grip and the controls beside it, so the row
        // stays a row.
        const handlesTop = handleTop(
          theme.sizeUnit,
          depth,
          extent,
          stepsAside(depth, placed, chromeAbove),
        );
        const selectable = editable && Boolean(placements[childId]);
        const selected = selection.selectedId === childId;
        // The container this drag would land in. Its own box, not the grid
        // inside it: the box is what the drop is tested against, and a
        // group's grid is that box less the title above it.
        const destination = landing?.parentId === childId;
        return (
          <GridItem
            key={childId}
            placement={carried && gesture ? gesture.origin : placed}
            dragging={carried}
            data-dragging={carried ? 'true' : undefined}
            offset={carried ? { x: gesture.dx, y: gesture.dy } : undefined}
            data-test="canvas-node"
            data-node-id={childId}
          >
            <Interactive
              className="canvas-interactive"
              showBounds={drag.dragging}
              $destination={destination}
              data-destination={destination ? 'true' : undefined}
              {...(selectable
                ? {
                    onPointerDown: begin(childId, 'move', false),
                    onClick: selectOnClick(childId),
                    // The press surface is a button so it can be selected and
                    // reached by keyboard; `data-canvas-selectable` keeps it
                    // out of the controls a press belongs to (see
                    // `OWN_GESTURE`), and the nested handles are the a11y
                    // price of that, as they are on any card whose whole face
                    // is clickable.
                    'data-canvas-selectable': true,
                    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
                    role: 'button',
                    tabIndex: 0,
                    'aria-pressed': selected,
                    'aria-label': labelOf(childId),
                    onKeyDown: keysOnWidget(childId, selected),
                  }
                : {})}
            >
              <WidgetBody
                editable={editable}
                offset={handlesTop}
                overflow={overflowFor(isContainer(childId), drag.dragging)}
              >
                {renderNode(childId)}
              </WidgetBody>
              {editable && placements[childId] && (
                <>
                  <Grip
                    type="button"
                    depth={depth}
                    offset={handlesTop}
                    className="canvas-handle"
                    aria-label={t('Move widget')}
                    data-test="canvas-drag-handle"
                    onPointerDown={begin(childId, 'move')}
                    onKeyDown={onKeyDown(childId, 'move')}
                  >
                    <Icons.HolderOutlined iconSize="s" />
                  </Grip>
                  <Remove
                    type="button"
                    depth={depth}
                    offset={handlesTop}
                    className="canvas-handle"
                    aria-label={t('Remove widget')}
                    data-test="canvas-remove-handle"
                    // A button, so `OWN_CLICK` already keeps this click from
                    // also selecting the widget being removed.
                    onClick={() => onRemove(childId)}
                  >
                    <Icons.DeleteOutlined iconSize="s" />
                  </Remove>
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
              {selected && (
                <Selected depth={depth} data-test="canvas-selected" />
              )}
            </Interactive>
          </GridItem>
        );
      })}
    </Grid>
  );
}
