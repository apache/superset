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

import { ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import CanvasGridSurface from './CanvasGridSurface';
import { CanvasWidgetChromeContext } from './widgetChrome';
import { CanvasDragProvider } from './useCanvasDrag';
import { RESIZE_CORNERS } from './gridGeometry';
import type { GridPlacement, SpanConstraints } from './types';

// jsdom lays nothing out, so the grid is told how wide it is: 1000px over 24
// columns with 16px gaps gives a 42.33px column pitch and a 56px row pitch.
const WIDTH = 1000;
const COL_PITCH = 632 / 24 + 16;
const ROW_PITCH = 56;

const placements: Record<string, GridPlacement> = {
  kpi: { col: 1, row: 1, colSpan: 6, rowSpan: 4 },
  // Well below `kpi`, so the ordinary drags in these tests land on empty
  // space. Dropping squarely onto a widget is a swap, which the tests for
  // that arrange deliberately.
  trend: { col: 1, row: 9, colSpan: 24, rowSpan: 8 },
};

const surface = (
  live: Record<string, GridPlacement>,
  editable: boolean,
  onPlace: jest.Mock,
  constraints: Record<string, SpanConstraints>,
  // Separate from `live`: a node can be a child of the grid without having a
  // resolved placement, and it must stay mounted when it does.
  childIds: string[] = Object.keys(live),
  renderNode: (nodeId: string) => ReactNode = nodeId => (
    <div>{`widget ${nodeId}`}</div>
  ),
  depth = 0,
  onSwap: jest.Mock = jest.fn(),
) => (
  // With a provider, as a canvas always has one: the grids register with it,
  // and it is what knows a drag is running.
  <CanvasDragProvider>
    <CanvasGridSurface
      parentId="root"
      onMove={jest.fn()}
      onSwap={onSwap}
      childIds={childIds}
      columns={24}
      gap={16}
      rowUnit={40}
      placements={live}
      layouts={live}
      constraints={constraints}
      editable={editable}
      depth={depth}
      onPlace={onPlace}
      renderNode={renderNode}
    />
  </CanvasDragProvider>
);

const renderSurface = ({
  editable = true,
  onPlace = jest.fn(),
  constraints = {} as Record<string, SpanConstraints>,
  live = placements,
  childIds = Object.keys(placements),
  renderNode,
  depth = 0,
  onSwap = jest.fn(),
}: {
  editable?: boolean;
  onPlace?: jest.Mock;
  onSwap?: jest.Mock;
  constraints?: Record<string, SpanConstraints>;
  live?: Record<string, GridPlacement>;
  childIds?: string[];
  renderNode?: (nodeId: string) => ReactNode;
  depth?: number;
} = {}) => {
  const { rerender, container } = render(
    surface(
      live,
      editable,
      onPlace,
      constraints,
      childIds,
      renderNode,
      depth,
      onSwap,
    ),
  );
  return Object.assign(onPlace, {
    container,
    onSwap,
    /** Simulate this grid's membership changing, e.g. a node reparented. */
    replaceChildren: (next: string[]) =>
      rerender(
        surface(live, editable, onPlace, constraints, next, renderNode, depth),
      ),
    /** Simulate a write landing while a gesture is still live. */
    replace: (next: Record<string, GridPlacement>) =>
      rerender(
        surface(next, editable, onPlace, constraints, childIds, renderNode),
      ),
    /** Simulate editing being switched off, e.g. a publish starting. */
    setEditable: (next: boolean) =>
      rerender(
        surface(live, next, onPlace, constraints, childIds, renderNode, depth),
      ),
  });
};

/**
 * jsdom's `PointerEvent` carries none of the properties a gesture needs, so
 * the pointer events are built on `MouseEvent`, which does support
 * coordinates and buttons, with the pointer id added on top.
 */
class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(
    type: string,
    init: MouseEventInit & { pointerId?: number } = {},
  ) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = init.pointerId ?? 1;
  }
}

const pointer = (
  handle: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: MouseEventInit & { pointerId?: number } = {},
) => fireEvent(handle, new TestPointerEvent(type, { pointerId: 1, ...init }));

/** A whole gesture on `handle`, from grab to release. */
const drag = (handle: HTMLElement, dx: number, dy: number) => {
  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: dx, clientY: dy });
  pointer(handle, 'pointerup', { clientX: dx, clientY: dy });
};

const handles = (name: 'Move widget' | 'Resize widget') =>
  screen.getAllByRole('button', {
    name: name === 'Move widget' ? name : /^Resize widget from/,
  });

/**
 * Resize handles for one corner only. Each widget has all four, so a test
 * that means "the bottom-right one" has to say so.
 */
const corners = (container: HTMLElement, corner = 'se') =>
  Array.from(
    container.querySelectorAll(`[data-corner="${corner}"]`),
  ) as HTMLElement[];

/**
 * jsdom never scrolls or lays anything out, so scrolling is simulated by
 * moving the grid's rect, which is what it measures.
 *
 * Any scrolling ancestor moves that rect -- the window, or the app shell's
 * content box, which is what scrolls while the chat panel is open. Reading the
 * window's own offset would miss the second, and Canvas opens that panel by
 * default.
 */
let contentOffsetY = 0;
const scrollTo = (y: number) => {
  contentOffsetY = y;
};

beforeEach(() => {
  contentOffsetY = 0;
});

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      // Only the grid reports a moving origin; everything else stays at zero,
      // which is what jsdom would return anyway.
      const scrolled =
        this.dataset.test === 'canvas-grid-surface' ? -contentOffsetY : 0;
      return {
        x: 0,
        y: scrolled,
        left: 0,
        top: scrolled,
        right: WIDTH,
        bottom: scrolled,
        width: WIDTH,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => WIDTH,
  });
  // jsdom has no pointer capture; the gesture only needs it not to throw.
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
});

test('dragging a widget persists the cells it was dropped on', () => {
  const onPlace = renderSurface();

  drag(handles('Move widget')[0], COL_PITCH * 4, ROW_PITCH * 2);

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 5,
    row: 3,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('resizing a widget persists the new spans and leaves its origin alone', () => {
  const onPlace = renderSurface();

  drag(corners(onPlace.container)[0], COL_PITCH * 3, ROW_PITCH);

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 1,
    row: 1,
    colSpan: 9,
    rowSpan: 5,
  });
});

test('a resize stops at the span limits the widget declares', () => {
  const onPlace = renderSurface({ constraints: { kpi: { maxColSpan: 8 } } });

  drag(corners(onPlace.container)[0], COL_PITCH * 10, 0);

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 1,
    row: 1,
    colSpan: 8,
    rowSpan: 4,
  });
});

test('a gesture too small to reach the next cell changes nothing', () => {
  const onPlace = renderSurface();

  drag(handles('Move widget')[0], 8, 10);

  expect(onPlace).not.toHaveBeenCalled();
});

test('a cancelled gesture is not persisted', () => {
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });
  pointer(handle, 'pointercancel');

  expect(onPlace).not.toHaveBeenCalled();
});

test('a drag shows where the widget would land', () => {
  renderSurface();
  const handle = handles('Move widget')[0];

  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(screen.getByTestId('canvas-drop-preview')).toBeInTheDocument();

  pointer(handle, 'pointerup', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();
});

test('arrow keys move a widget a cell at a time', () => {
  const onPlace = renderSurface();

  fireEvent.keyDown(handles('Move widget')[0], { key: 'ArrowRight' });

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 2,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('arrow keys on the resize corner resize a cell at a time', () => {
  const onPlace = renderSurface();

  fireEvent.keyDown(corners(onPlace.container)[0], { key: 'ArrowDown' });

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 1,
    row: 1,
    colSpan: 6,
    rowSpan: 5,
  });
});

test('a non-primary button does not start a gesture', () => {
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', { button: 2, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });
  pointer(handle, 'pointerup', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(onPlace).not.toHaveBeenCalled();
});

test('a view-only surface renders the widgets with no handles', () => {
  renderSurface({ editable: false });

  expect(screen.getByText('widget kpi')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Move widget' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /^Resize widget from/ }),
  ).not.toBeInTheDocument();
});

test('the drop lands where the pointer was released, not where it last moved', () => {
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: COL_PITCH, clientY: 0 });
  // The pointer travels further before the release reports its own position.
  pointer(handle, 'pointerup', { clientX: COL_PITCH * 5, clientY: 0 });

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 6,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('a cancel from a different pointer leaves the gesture alone', () => {
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  });
  pointer(handle, 'pointermove', {
    pointerId: 1,
    clientX: COL_PITCH * 4,
    clientY: 0,
  });
  // A second pointer going away must not discard the first one's drag.
  pointer(handle, 'pointercancel', { pointerId: 2 });
  pointer(handle, 'pointerup', {
    pointerId: 1,
    clientX: COL_PITCH * 4,
    clientY: 0,
  });

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 5,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('a write landing mid-gesture does not move the ground under the pointer', () => {
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  // Grab 'kpi' at row 1 and drag two rows down: it is heading for row 3.
  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: 0, clientY: ROW_PITCH * 2 });

  // Mid-gesture, the server resolves a sibling's drop and pushes 'kpi' to
  // row 9 — the kind of thing a draft poll or another drag's response does.
  onPlace.replace({
    ...placements,
    kpi: { col: 1, row: 9, colSpan: 6, rowSpan: 4 },
  });

  pointer(handle, 'pointerup', { clientX: 0, clientY: ROW_PITCH * 2 });

  // The drop is two rows from where the user grabbed it, not from row 9.
  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 1,
    row: 3,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('a click on a handle does not revert a write that landed mid-hold', () => {
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  // Pressed and released with no movement, so the gesture resolves back to
  // where 'kpi' was grabbed.
  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });

  // While the button is held, a draft poll or another editor's resize moves
  // 'kpi'. Committing the unmoved gesture now would write row 1 back over it.
  onPlace.replace({
    ...placements,
    kpi: { col: 1, row: 9, colSpan: 6, rowSpan: 4 },
  });

  pointer(handle, 'pointerup', { clientX: 0, clientY: 0 });

  expect(onPlace).not.toHaveBeenCalled();
});

test('a widget with no resolved placement renders, with no handles', () => {
  // Still a child of the grid, so it stays mounted; it just has nowhere to be
  // dragged from, so it gets no handles while its sibling keeps its own.
  renderSurface({
    live: { trend: placements.trend },
    childIds: ['kpi', 'trend'],
  });

  expect(screen.getByText('widget kpi')).toBeInTheDocument();
  expect(handles('Move widget')).toHaveLength(1);
  expect(handles('Resize widget')).toHaveLength(RESIZE_CORNERS.length);
});

test('a second pointer cannot steal a live gesture', () => {
  const onPlace = renderSurface();
  const [first, second] = handles('Move widget');

  // One finger grabs 'kpi'.
  pointer(first, 'pointerdown', {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  });
  // Another touches 'trend's handle: also button 0, so only an explicit guard
  // stops it replacing the live gesture and stranding the first pointer.
  pointer(second, 'pointerdown', {
    button: 0,
    pointerId: 2,
    clientX: 0,
    clientY: 0,
  });

  // The first finger finishes its drag and is still the one that commits.
  pointer(first, 'pointermove', {
    pointerId: 1,
    clientX: COL_PITCH * 4,
    clientY: 0,
  });
  pointer(first, 'pointerup', {
    pointerId: 1,
    clientX: COL_PITCH * 4,
    clientY: 0,
  });

  expect(onPlace).toHaveBeenCalledTimes(1);
  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 5,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
  });
});

/** A widget holding its own state, as filter.select and tabs do. */
const Stateful = ({ nodeId }: { nodeId: string }) => {
  const [picked, setPicked] = useState('');
  return (
    <div>
      <button type="button" onClick={() => setPicked('EMEA')}>
        {`pick ${nodeId}`}
      </button>
      <span>{`${nodeId} picked=${picked}`}</span>
    </div>
  );
};

test('a widget keeps its own state when editing is switched off and back on', () => {
  // Swapping the element type around a widget remounts it, losing state the
  // widget owns: a filter would forget its selection while the charts stayed
  // filtered. Publish flips `editable`, and flips it back when it fails.
  const onPlace = renderSurface({
    renderNode: nodeId => <Stateful nodeId={nodeId} />,
  });

  fireEvent.click(screen.getByRole('button', { name: 'pick kpi' }));
  expect(screen.getByText('kpi picked=EMEA')).toBeInTheDocument();

  onPlace.setEditable(false);
  expect(screen.getByText('kpi picked=EMEA')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Move widget' }),
  ).not.toBeInTheDocument();

  onPlace.setEditable(true);
  expect(screen.getByText('kpi picked=EMEA')).toBeInTheDocument();
  expect(handles('Move widget')).toHaveLength(2);
});

test('a gesture is released when editing stops mid-drag', () => {
  // Its handle unmounts, so no up or cancel event can ever reach it. Left
  // live, the one-gesture-at-a-time guard would block every later drag.
  const onPlace = renderSurface();
  pointer(handles('Move widget')[0], 'pointerdown', {
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  pointer(handles('Move widget')[0], 'pointermove', {
    clientX: COL_PITCH * 4,
    clientY: 0,
  });
  expect(screen.getByTestId('canvas-drop-preview')).toBeInTheDocument();

  onPlace.setEditable(false);

  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();

  // Editing resumes and dragging still works, rather than being dead.
  onPlace.setEditable(true);
  drag(handles('Move widget')[0], COL_PITCH * 4, 0);

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 5,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('a gesture is released when its node stops being placeable', () => {
  const onPlace = renderSurface();
  pointer(handles('Move widget')[0], 'pointerdown', {
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  pointer(handles('Move widget')[0], 'pointermove', {
    clientX: COL_PITCH * 4,
    clientY: 0,
  });

  // A draft poll removes 'kpi' from the resolved placements.
  onPlace.replace({ trend: placements.trend });

  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();
  // The surviving widget is still draggable.
  drag(handles('Move widget')[0], 0, ROW_PITCH);
  expect(onPlace).toHaveBeenCalledWith('trend', {
    col: 1,
    row: 10,
    colSpan: 24,
    rowSpan: 8,
  });
});

test('a gesture is released when its node moves to another grid', () => {
  // The node is still placed somewhere on the canvas, so a placements-only
  // check misses it -- but its handle has unmounted from this grid, so no
  // up, cancel or lost-capture event can ever reach it. Left live, the
  // one-gesture guard would block every later drag on this grid.
  const onPlace = renderSurface();
  pointer(handles('Move widget')[0], 'pointerdown', {
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  pointer(handles('Move widget')[0], 'pointermove', {
    clientX: COL_PITCH * 4,
    clientY: 0,
  });
  expect(screen.getByTestId('canvas-drop-preview')).toBeInTheDocument();

  // A draft poll moves 'kpi' into another container: still placed, no longer
  // a child of this grid.
  onPlace.replaceChildren(['trend']);

  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();
  // And this grid still works.
  drag(handles('Move widget')[0], 0, ROW_PITCH);
  expect(onPlace).toHaveBeenCalledWith('trend', {
    col: 1,
    row: 10,
    colSpan: 24,
    rowSpan: 8,
  });
});

const gripTop = () => getComputedStyle(handles('Move widget')[0]).top;

test("a root grid's grip lines up with the widget's own controls", () => {
  // The grip, the More Options button and the north-east resize corner all
  // sit in the widget's top right, so they have to read as one row. The
  // controls are a `sizeUnit * 8` square at `top: 0` (see WithQuery's
  // `.canvas-widget-controls`); the grip matches both, or it floats a few
  // pixels high next to them.
  renderSurface();
  const grip = getComputedStyle(handles('Move widget')[0]);

  expect(grip.top).toBe('0px');
  expect(grip.height).toBe('32px');
  expect(grip.width).toBe('32px');
});

/** Nested, and sitting right where the container's own handles are. */
const underContainerHandles = {
  live: { wide: { col: 1, row: 1, colSpan: 24, rowSpan: 4 } },
  childIds: ['wide'],
  depth: 1,
};

test("a nested grid offsets the handles that land on its container's", () => {
  // A container's box begins where its first row of children does and its
  // handles paint last, so sharing the spot would let the container's grip
  // swallow clicks meant for the child's.
  renderSurface(underContainerHandles);

  expect(gripTop()).toBe('36px');
});

test('a nested widget clear of those handles keeps its own at the top', () => {
  // Six columns wide at the left: nothing of the container's is up there to
  // clear, and stepping down anyway strands the handles in the middle of the
  // widget -- which is what a nested KPI tile looked like.
  renderSurface({ depth: 1 });

  expect(gripTop()).toBe('0px');
});

test('a nested widget below the first row keeps its handles at the top', () => {
  // The container's handles are at the top of its box; a child further down
  // is nowhere near them, however wide it is.
  renderSurface({
    live: { lower: { col: 1, row: 3, colSpan: 24, rowSpan: 4 } },
    childIds: ['lower'],
    depth: 1,
  });

  expect(gripTop()).toBe('0px');
});

test('a nested handle stays inside a short widget', () => {
  // A one-row widget renders 40px tall. An unclamped depth offset would put
  // the grip at 36px plus its own box, i.e. over the widget below -- where it
  // would take presses meant for that one.
  renderSurface({
    live: { short: { col: 1, row: 1, colSpan: 24, rowSpan: 1 } },
    childIds: ['short'],
    depth: 1,
  });

  const top = Number.parseInt(gripTop(), 10);
  expect(top).toBeGreaterThan(0);
  // Its own box has to fit below the offset, inside the 40px widget.
  expect(top).toBeLessThanOrEqual(40 - 7 * 4);
});

test('a hidden handle does not take presses', () => {
  // Handles are only transparent at rest. Without this they would still win
  // the hit test over whatever they sit above.
  renderSurface();

  expect(getComputedStyle(handles('Move widget')[0]).pointerEvents).toBe(
    'none',
  );
});

const cornerBottom = (container: HTMLElement, corner = 'se') =>
  getComputedStyle(corners(container, corner)[0]).bottom;

test("the root grid's resize corner sits on the widget's own corner", () => {
  const onPlace = renderSurface();

  expect(cornerBottom(onPlace.container)).toBe('0px');
});

test("a nested grid lifts its resize corner clear of its container's", () => {
  // A container's box ends where its last child's does and the container's
  // corner paints later, so sharing the pixel makes the child's unreachable.
  const onPlace = renderSurface({ depth: 1 });

  const bottom = Number.parseInt(cornerBottom(onPlace.container), 10);
  expect(bottom).toBeGreaterThan(0);
  // Still inside the widget, like the grip offsets above.
  expect(bottom).toBeLessThan(placements.kpi.rowSpan * 40);
});

test('a drag follows the content when it scrolls under the pointer', () => {
  // Pointer coordinates are relative to the viewport, so scrolling while
  // holding moves the content under a still pointer. Without compensating,
  // the drag reports no movement and the drop writes nothing. Measured from
  // the grid's own rect rather than the window's scroll offset, because with
  // the chat panel open -- which Canvas does by default -- the shell is locked
  // and it is the content box that scrolls.
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  scrollTo(ROW_PITCH * 2);
  // Released at the same screen position, two rows further down the content.
  pointer(handle, 'pointerup', { clientX: 0, clientY: 0 });

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 1,
    row: 3,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('each widget wrapper is marked so the innermost one can be detected', () => {
  // The hover rule narrows to the innermost widget with
  // `:not(:has(.canvas-interactive:hover))`, which silently stops working if
  // this class goes away. jsdom cannot evaluate `:has()` against a hover
  // state, so the class itself is what is pinned here.
  const { container } = renderSurface();

  expect(container.querySelectorAll('.canvas-interactive')).toHaveLength(2);
});

const rowOf = (container: HTMLElement, nodeId: string) =>
  getComputedStyle(
    container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement,
  ).gridRow;

test('a drop onto one widget exchanges places with it, before the drop', () => {
  // Live reflow: the same rules the write will apply run on every move, so
  // nothing jumps once it lands. Landing squarely on one widget is a swap --
  // it takes the slot the dragged one came from.
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  expect(rowOf(onPlace.container, 'trend')).toContain('9');

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  // 'kpi' is 4 rows tall at row 1; eight rows down puts it on 'trend'.
  pointer(handle, 'pointermove', { clientX: 0, clientY: ROW_PITCH * 8 });

  // 'trend' takes row 1, which 'kpi' has just left.
  expect(rowOf(onPlace.container, 'trend')).toContain('1/');

  pointer(handle, 'pointerup', { clientX: 0, clientY: ROW_PITCH * 8 });

  // And both are written together, as the exchange they are: a `place` would
  // move one and leave the other to be pushed somewhere by the server.
  expect(onPlace).not.toHaveBeenCalled();
  expect(onPlace.onSwap).toHaveBeenCalledTimes(1);
  expect(onPlace.onSwap).toHaveBeenCalledWith(
    'kpi',
    { col: 1, row: 9, colSpan: 6, rowSpan: 4 },
    'trend',
    // 'trend' keeps its own size in the slot 'kpi' left.
    { col: 1, row: 1, colSpan: 24, rowSpan: 8 },
  );
});

test('a drop straddling two widgets pushes them down instead', () => {
  // Only a definite landing is an exchange. Across two widgets there is no
  // single partner to trade with, so reading order decides and the ones it
  // lands among move down.
  const onPlace = jest.fn();
  const stacked = {
    a: { col: 1, row: 1, colSpan: 24, rowSpan: 2 },
    b: { col: 1, row: 3, colSpan: 24, rowSpan: 2 },
    c: { col: 1, row: 5, colSpan: 24, rowSpan: 2 },
  };
  render(
    <CanvasDragProvider>
      <CanvasGridSurface
        parentId="root"
        onMove={jest.fn()}
        onSwap={jest.fn()}
        childIds={['a', 'b', 'c']}
        columns={24}
        gap={16}
        rowUnit={40}
        placements={stacked}
        layouts={stacked}
        constraints={{}}
        editable
        depth={0}
        onPlace={onPlace}
        renderNode={nodeId => <div>{`widget ${nodeId}`}</div>}
      />
    </CanvasDragProvider>,
  );

  // 'a' is two rows tall; two rows down straddles 'b' and 'c'.
  const handle = handles('Move widget')[0];
  drag(handle, 0, ROW_PITCH * 3);

  expect(onPlace).toHaveBeenCalledWith('a', {
    col: 1,
    row: 4,
    colSpan: 24,
    rowSpan: 2,
  });
});

test('neighbours go back when a gesture is abandoned', () => {
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];
  const before = rowOf(onPlace.container, 'trend');

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: 0, clientY: ROW_PITCH * 4 });
  pointer(handle, 'pointercancel');

  expect(rowOf(onPlace.container, 'trend')).toBe(before);
});

test('the drop outline no longer carries an error state', () => {
  // Overlap is shown by the neighbours moving, not by colouring this red.
  renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: 0, clientY: ROW_PITCH * 4 });

  const outline = screen.getByTestId('canvas-drop-preview');
  expect(outline).not.toHaveAttribute('data-colliding');
  expect(outline).not.toHaveAttribute('title');
});

const widgetBody = (container: HTMLElement, nodeId: string) =>
  container.querySelector(
    `[data-node-id="${nodeId}"] .canvas-interactive`,
  ) as HTMLElement;

test('the widget body itself can be dragged in a plan', () => {
  // The grip is small and hover-only, so the whole widget is a drag source
  // where editing is allowed.
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(body, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });
  pointer(body, 'pointerup', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 5,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
  });
});

/** Widgets lift while being dragged, which is how "is it dragging" is read. */
const liftedOpacity = (container: HTMLElement, nodeId: string) =>
  getComputedStyle(
    container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement,
  ).opacity;

test("an unmoved press reaches the widget's own controls", () => {
  // The real point of the threshold: a press that is not a drag must not be
  // captured by the wrapper, or the release and the click after it are
  // retargeted and the widget's own button never fires. Pointer capture is
  // stubbed here, so this asserts the click itself rather than the lift.
  const clicked = jest.fn();
  const onPlace = renderSurface({
    renderNode: nodeId => (
      <button type="button" onClick={clicked}>{`open ${nodeId}`}</button>
    ),
  });
  const button = screen.getByRole('button', { name: 'open kpi' });

  pointer(button, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(button, 'pointerup', { clientX: 0, clientY: 0 });
  fireEvent.click(button);

  expect(clicked).toHaveBeenCalledTimes(1);
  expect(onPlace).not.toHaveBeenCalled();
});

test('an unmoved press never takes the pointer', () => {
  // Capturing on pointerdown is what retargets the release, so the capture
  // itself is asserted rather than only its visible consequence.
  const capture = jest.spyOn(HTMLElement.prototype, 'setPointerCapture');
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');
  capture.mockClear();

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(body, 'pointermove', { clientX: 2, clientY: 1 });

  expect(capture).not.toHaveBeenCalled();

  // Once it is really a drag, the pointer is taken.
  pointer(body, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });
  expect(capture).toHaveBeenCalled();
  capture.mockRestore();
});

test('a press on a widget body that barely moves stays a click', () => {
  // Otherwise every click on a chart in a plan would make the widget lift and
  // follow the pointer for a frame before settling back.
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(body, 'pointermove', { clientX: 2, clientY: 1 });

  // Not dragging: no lift (the property is only set while dragging), and
  // nothing previewed.
  expect(liftedOpacity(onPlace.container, 'kpi')).not.toBe('0.85');
  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();

  pointer(body, 'pointerup', { clientX: 2, clientY: 1 });

  expect(onPlace).not.toHaveBeenCalled();
});

test('a body press past the threshold does start dragging', () => {
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(body, 'pointermove', { clientX: 10, clientY: 0 });

  expect(liftedOpacity(onPlace.container, 'kpi')).toBe('0.85');
});

test('a body drag arms once the pointer has really travelled', () => {
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  // Past the threshold but less than a cell: armed, though it snaps back to
  // where it started, so nothing is written on release.
  pointer(body, 'pointermove', { clientX: 10, clientY: 0 });

  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();

  pointer(body, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(screen.getByTestId('canvas-drop-preview')).toBeInTheDocument();
});

test('the body is not a drag source on a published canvas', () => {
  const onPlace = renderSurface({ editable: false });
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(body, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });
  pointer(body, 'pointerup', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(onPlace).not.toHaveBeenCalled();
});

/**
 * Drags a *different* widget and asserts it moved, as proof the grid is free.
 *
 * It has to be a different one: a stranded gesture reuses the same pointer id,
 * so a recovery drag on the same widget from the same point would be
 * indistinguishable from the stranded gesture finally committing.
 */
const recover = (onPlace: jest.Mock & { container: HTMLElement }) => {
  drag(handles('Move widget')[1], 0, ROW_PITCH * 2);

  expect(onPlace).toHaveBeenCalledWith('trend', {
    col: 1,
    row: 11,
    colSpan: 24,
    rowSpan: 8,
  });
};

test('a press released away from the widget still frees the grid', () => {
  // An unarmed press holds no pointer capture -- it has to let a click
  // through -- so its release lands wherever the pointer is, which need not
  // be this widget or even this grid. A release the grid never sees would
  // leave the gesture live, and since only one may be live at a time, every
  // later drag and resize here would be refused.
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(document.body, 'pointerup', { clientX: 0, clientY: 0 });

  // Nothing was dragged, and the grid still takes a new gesture.
  expect(onPlace).not.toHaveBeenCalled();
  recover(onPlace);
});

/** A widget that handles `pointerup` itself and stops it going any further. */
const Swallow = ({ label }: { label: string }) => (
  <div
    ref={node => {
      node?.addEventListener('pointerup', event => event.stopPropagation());
    }}
  >
    {label}
  </div>
);

test('a widget that swallows the release does not strand the gesture', () => {
  const onPlace = renderSurface({
    renderNode: nodeId => <Swallow label={`widget ${nodeId}`} />,
  });
  const body = widgetBody(onPlace.container, 'kpi');
  const swallow = screen.getByText('widget kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(swallow, 'pointerup', { clientX: 0, clientY: 0 });

  expect(onPlace).not.toHaveBeenCalled();
  recover(onPlace);
});

test('a drag that leaves the widget before the threshold still arms', () => {
  // A flick can put the first move event well outside the widget, so arming
  // cannot depend on the widget seeing the move either.
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(document.body, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });
  pointer(document.body, 'pointerup', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 5,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
  });
});

const controls: [string, (nodeId: string) => ReactNode][] = [
  ['a form control', nodeId => <input aria-label={`control ${nodeId}`} />],
  [
    'a range slider',
    nodeId => (
      <input type="range" aria-label={`control ${nodeId}`} defaultValue={5} />
    ),
  ],
  [
    'a slider handle',
    // Antd's Slider handle is a div carrying the role, not an input, which is
    // why the role is matched as well as the tag.
    nodeId => (
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
      <div role="slider" aria-valuenow={5} aria-label={`control ${nodeId}`} />
    ),
  ],
  [
    'an opted-out element',
    nodeId => <div data-canvas-no-drag aria-label={`control ${nodeId}`} />,
  ],
];

test.each(controls)(
  'a press on %s inside a widget does not move it',
  (_name, control) => {
    // These handle press-and-drag themselves. Turning that into a widget move
    // would make a range filter impossible to set while a plan is open.
    const onPlace = renderSurface({ renderNode: control });
    const target = screen.getByLabelText('control kpi');

    pointer(target, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
    pointer(target, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });
    pointer(target, 'pointerup', { clientX: COL_PITCH * 4, clientY: 0 });

    expect(onPlace).not.toHaveBeenCalled();
  },
);

/** A widget whose content overflows, so its scroll container has a scrollbar. */
const scrolling = (container: HTMLElement, nodeId: string) => {
  const content = container.querySelector(
    `[data-node-id="${nodeId}"] .canvas-interactive > div`,
  ) as HTMLElement;
  // jsdom lays nothing out, so the overflow is declared rather than produced.
  Object.defineProperty(content, 'scrollHeight', {
    configurable: true,
    value: 4000,
  });
  Object.defineProperty(content, 'clientHeight', {
    configurable: true,
    value: 200,
  });
  return content;
};

test("a press on a tall widget's scrollbar scrolls it rather than moving it", () => {
  // A table is the common case: it scrolls inside its cells, and dragging the
  // scrollbar has to keep scrolling it once a plan is open.
  const onPlace = renderSurface({
    renderNode: nodeId => (
      <div style={{ height: 4000 }}>{`tall ${nodeId}`}</div>
    ),
  });
  const content = scrolling(onPlace.container, 'kpi');

  // Past the right edge of the content box, which is where the scrollbar is.
  const onBar = { clientX: WIDTH + 4, clientY: 50 };
  pointer(content, 'pointerdown', { button: 0, ...onBar });
  pointer(content, 'pointermove', { ...onBar, clientY: ROW_PITCH * 2 });
  pointer(content, 'pointerup', { ...onBar, clientY: ROW_PITCH * 2 });

  expect(onPlace).not.toHaveBeenCalled();
});

test('a press inside a tall widget still drags it', () => {
  // The other side of the check above: only the scrollbar is excluded, not
  // the whole of a widget that happens to scroll.
  const onPlace = renderSurface({
    renderNode: nodeId => (
      <div style={{ height: 4000 }}>{`tall ${nodeId}`}</div>
    ),
  });
  const content = scrolling(onPlace.container, 'kpi');

  pointer(content, 'pointerdown', { button: 0, clientX: 10, clientY: 50 });
  pointer(content, 'pointermove', { clientX: 10 + COL_PITCH * 4, clientY: 50 });
  pointer(content, 'pointerup', { clientX: 10 + COL_PITCH * 4, clientY: 50 });

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 5,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('text in a widget is not selectable while a plan is open', () => {
  // Dragging across a table would otherwise select its text and move the
  // widget at once. In a plan the drag wins; a published canvas selects
  // normally.
  const editing = renderSurface();
  const published = renderSurface({ editable: false });
  const content = (container: HTMLElement) =>
    container.querySelector(
      '[data-node-id="kpi"] .canvas-interactive > div',
    ) as HTMLElement;

  expect(getComputedStyle(content(editing.container)).userSelect).toBe('none');
  expect(getComputedStyle(content(published.container)).userSelect).not.toBe(
    'none',
  );
});

test('every widget offers all four resize corners, each named', () => {
  const onPlace = renderSurface();

  RESIZE_CORNERS.forEach(corner => {
    expect(corners(onPlace.container, corner)).toHaveLength(2);
  });
  // Named individually, so a screen reader can tell them apart.
  expect(
    screen.getAllByRole('button', { name: /Resize widget from the top left/ }),
  ).toHaveLength(2);
});

test('a north-west drag at the grid origin has nowhere to grow', () => {
  // 'kpi' already starts at col 1 row 1, so pulling up and left cannot widen
  // it; the placement is unchanged and nothing is written.
  const onPlace = renderSurface();

  drag(corners(onPlace.container, 'nw')[0], -COL_PITCH * 2, -ROW_PITCH);

  expect(onPlace).not.toHaveBeenCalled();
});

test('a north-west drag on a widget away from the edge grows up and left', () => {
  const onPlace = renderSurface({
    live: { mid: { col: 10, row: 5, colSpan: 6, rowSpan: 4 } },
    childIds: ['mid'],
  });

  drag(corners(onPlace.container, 'nw')[0], -COL_PITCH * 2, -ROW_PITCH * 1);

  // Bottom-right stays at col 15, row 8.
  expect(onPlace).toHaveBeenCalledWith('mid', {
    col: 8,
    row: 4,
    colSpan: 8,
    rowSpan: 5,
  });
});

test('all four corners sit at the widget corners, none singled out', () => {
  // The north-east one used to be pushed down to clear a widget's controls,
  // which looked like a mistake. WithQuery steps those aside while a plan is
  // open instead, so the four handles are symmetric.
  const onPlace = renderSurface();
  const edge = (corner: string, side: 'top' | 'bottom') =>
    getComputedStyle(corners(onPlace.container, corner)[0])[side];

  expect(edge('nw', 'top')).toBe('0px');
  expect(edge('ne', 'top')).toBe('0px');
  expect(edge('sw', 'bottom')).toBe('0px');
  expect(edge('se', 'bottom')).toBe('0px');
});

test('a widget taller than its cells scrolls rather than spilling over', () => {
  // A table renders every row at its natural height. Without a scroll
  // container it overflows its own box and across whatever is below, while
  // the outline and the handles still mark the box -- which is what made the
  // handles look like they sat in the middle of the table.
  const onPlace = renderSurface({
    renderNode: nodeId => (
      <div style={{ height: 4000 }}>{`tall ${nodeId}`}</div>
    ),
  });

  const content = onPlace.container.querySelector(
    '[data-node-id="kpi"] .canvas-interactive > div',
  ) as HTMLElement;

  expect(getComputedStyle(content).overflow).toBe('auto');
  expect(getComputedStyle(content).height).toBe('100%');
});

test("a widget's own layering cannot escape over the handles", () => {
  // A widget stacks inside its own box. Without that, anything it renders
  // with a high z-index paints over the canvas: an antd table's sticky header
  // sits at columns * 2 + 3, which already beats the handles at three columns
  // and climbs from there, so raising the handles is not a fix.
  const onPlace = renderSurface();
  const content = onPlace.container.querySelector(
    '[data-node-id="kpi"] .canvas-interactive > div',
  ) as HTMLElement;

  expect(getComputedStyle(content).isolation).toBe('isolate');

  // And the handles still sit above that box, as siblings of it.
  const grip = handles('Move widget')[0];
  expect(Number(getComputedStyle(grip).zIndex)).toBeGreaterThan(0);
  expect(grip.parentElement).toBe(content.parentElement);
});

test('the handles are not inside the scrolling area', () => {
  // They are siblings of the content, so they stay pinned to the widget's
  // corners instead of scrolling away with it.
  const onPlace = renderSurface();
  const handle = corners(onPlace.container, 'se')[0];

  expect(handle.parentElement).toHaveClass('canvas-interactive');
});

test('a widget being dragged is opaque enough to read as lifted', () => {
  // At 0.85 opacity over nothing, the neighbours and the drop outline showed
  // through the dragged widget and it read as sliding underneath them. A
  // widget draws no background of its own, so the lift has to supply one.
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(body, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });

  const item = onPlace.container.querySelector(
    '[data-node-id="kpi"]',
  ) as HTMLElement;
  const style = getComputedStyle(item);

  expect(style.background).not.toBe('');
  expect(style.boxShadow).not.toBe('');
});

test('only the widget being dragged is marked as such', () => {
  // The marker an ancestor's scroll box keys on to stop clipping.
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');
  const item = (nodeId: string) =>
    onPlace.container.querySelector(`[data-node-id="${nodeId}"]`);

  expect(item('kpi')).not.toHaveAttribute('data-dragging');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(body, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(item('kpi')).toHaveAttribute('data-dragging', 'true');
  expect(item('trend')).not.toHaveAttribute('data-dragging');

  pointer(body, 'pointerup', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(item('kpi')).not.toHaveAttribute('data-dragging');
});

test('a resize does not unclip the containers around it', () => {
  // The marker makes every ancestor scroll box stop clipping, which is right
  // for a move -- the widget is leaving its container -- and wrong for a
  // resize, where it stays put. Unclipping during a resize lets a scrolling
  // widget render at full height for the length of the gesture: a table
  // spills its rows, and its sticky header, over whatever is below.
  const onPlace = renderSurface();
  const corner = corners(onPlace.container, 'se')[0];
  const item = onPlace.container.querySelector('[data-node-id="kpi"]');

  pointer(corner, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(corner, 'pointermove', {
    clientX: COL_PITCH * 3,
    clientY: ROW_PITCH,
  });

  // Really resizing -- the outline is up -- but nothing is marked as dragged.
  expect(screen.getByTestId('canvas-drop-preview')).toBeInTheDocument();
  expect(item).not.toHaveAttribute('data-dragging');

  pointer(corner, 'pointerup', { clientX: COL_PITCH * 3, clientY: ROW_PITCH });

  expect(onPlace).toHaveBeenCalled();
});

test("a container's scroll box stops clipping while a widget inside it drags", () => {
  // A child dragged towards its container's edge is leaving the container's
  // box. Clipping would cut it off there and grow a scrollbar, which is the
  // opposite of what the gesture means. jsdom does not evaluate `:has()`, so
  // the rule itself is asserted rather than its effect.
  const { container } = render(
    surface(placements, true, jest.fn(), {}, Object.keys(placements)),
  );
  const content = container.querySelector(
    '[data-node-id="kpi"] .canvas-interactive > div',
  ) as HTMLElement;
  // Emotion inserts its rules through the CSSOM rather than as text.
  const rules = Array.from(document.styleSheets)
    .flatMap(sheet => {
      try {
        return Array.from(sheet.cssRules);
      } catch {
        return [];
      }
    })
    .map(rule => rule.cssText)
    .join('\n');

  // Scoped to the content box's own class, so the rule is on the element that
  // does the clipping rather than merely present somewhere.
  const override = rules
    .split('\n')
    .filter(
      rule =>
        rule.includes('data-dragging') &&
        Array.from(content.classList).some(name => rule.includes(`.${name}`)),
    );

  expect(override).not.toHaveLength(0);
  expect(override.join('\n')).toMatch(/overflow:\s*visible/);
});

test('a drag inside a modal the widget opened does not move the widget', () => {
  // React routes a portalled child's events through the component that
  // rendered it, so a press in a modal arrives at the widget's wrapper even
  // though it renders at the document root. Selecting query text in a widget's
  // View query modal would otherwise persist a move of the widget behind it.
  const onPlace = renderSurface({
    renderNode: nodeId => (
      <>
        {`widget ${nodeId}`}
        {createPortal(
          <div data-test={`modal-${nodeId}`}>query text</div>,
          document.body,
        )}
      </>
    ),
  });
  const inModal = screen.getByTestId('modal-kpi');

  // The portal renders outside the grid, so this is not a press on the widget.
  expect(onPlace.container.contains(inModal)).toBe(false);

  pointer(inModal, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(inModal, 'pointermove', { clientX: COL_PITCH * 4, clientY: 0 });
  pointer(inModal, 'pointerup', { clientX: COL_PITCH * 4, clientY: 0 });

  expect(onPlace).not.toHaveBeenCalled();
  // And the grid is still usable afterwards.
  recover(onPlace);
});

test('the preview follows a scroll made without moving the pointer', () => {
  // The release folds the scroll offset in, so the preview has to as well:
  // otherwise the outline shows the pre-scroll cells and the drop saves the
  // scrolled ones, and the widget lands where nothing was ever previewed.
  const onPlace = renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  // Armed by a pointer move, then scrolled with the pointer held still.
  pointer(handle, 'pointermove', { clientX: 0, clientY: ROW_PITCH });
  const previewRow = () =>
    getComputedStyle(screen.getByTestId('canvas-drop-preview')).gridRow;
  expect(previewRow()).toBe('2/span 4');

  scrollTo(ROW_PITCH * 2);
  fireEvent.scroll(onPlace.container.firstChild as HTMLElement);

  // Two further rows of content have passed under the pointer.
  expect(previewRow()).toBe('4/span 4');

  pointer(handle, 'pointerup', { clientX: 0, clientY: ROW_PITCH });

  // And the drop matches what was previewed.
  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 1,
    row: 4,
    colSpan: 6,
    rowSpan: 4,
  });
});

test('a press held while scrolling is not turned into a drag', () => {
  // Scrolling past a widget with the button down is not a gesture, so an
  // unarmed press must not arm on scroll alone.
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  scrollTo(ROW_PITCH * 4);
  fireEvent.scroll(onPlace.container.firstChild as HTMLElement);

  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();

  pointer(body, 'pointerup', { clientX: 0, clientY: 0 });

  expect(onPlace).not.toHaveBeenCalled();
});

test('the grid cannot shrink while a gesture is running', () => {
  // Dragging a widget up can leave the grid needing fewer rows. Letting it
  // shrink while the view is scrolled near the bottom makes the browser clamp
  // the scroll position, sliding the content under a still pointer -- which
  // feeds back into the preview, since travel is measured against the grid's
  // own position. The drag then fights the user and the page scrolls by
  // itself. The floor holds until the gesture ends.
  const onPlace = renderSurface();
  const surface = screen.getByTestId('canvas-grid-surface');
  Object.defineProperty(surface, 'offsetHeight', {
    configurable: true,
    value: 720,
  });
  const floor = () => getComputedStyle(surface).minHeight;

  expect(floor()).toBe('');

  const handle = handles('Move widget')[1];
  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: 0, clientY: -ROW_PITCH * 2 });

  expect(floor()).toBe('720px');
  // And the browser stops correcting the scroll position behind our back:
  // reordering content above the viewport would otherwise make it adjust
  // scrollTop, which moves the grid that travel is measured against.
  expect(getComputedStyle(surface).overflowAnchor).toBe('none');

  pointer(handle, 'pointerup', { clientX: 0, clientY: -ROW_PITCH * 2 });

  // Released: the grid is free to settle at whatever the new layout needs,
  // and anchoring goes back to normal.
  expect(floor()).toBe('');
  expect(getComputedStyle(surface).overflowAnchor).not.toBe('none');
  expect(onPlace).toHaveBeenCalled();
});

/** A widget that puts something in whatever chrome node the canvas offers. */
const PortalProbe = () => {
  const chrome = useContext(CanvasWidgetChromeContext);
  return (
    <>
      <span>widget body</span>
      {chrome && createPortal(<button type="button">probe</button>, chrome)}
    </>
  );
};

test('a widget is offered a chrome node beside its content', () => {
  // A widget's content box scrolls, clips and is its own stacking context, so
  // chrome rendered inside it is subject to whatever that widget stacks -- an
  // antd table's sticky header buries a menu at the top right. The canvas
  // offers a node beside that box, as a sibling of the handles.
  const onPlace = renderSurface({ renderNode: () => <PortalProbe /> });

  const probe = screen.getAllByRole('button', { name: 'probe' })[0];
  const chrome = probe.parentElement as HTMLElement;
  const wrapper = chrome.parentElement as HTMLElement;

  expect(chrome).toHaveClass('canvas-chrome');
  // Beside the scrolling content, and inside the box the handles are pinned to.
  expect(wrapper).toHaveClass('canvas-interactive');
  expect(getComputedStyle(chrome).pointerEvents).toBe('none');

  const content = onPlace.container.querySelector(
    '[data-node-id="kpi"] .canvas-interactive > div',
  ) as HTMLElement;
  expect(content.contains(probe)).toBe(false);
});

test('scrolling under a held pointer does not arm a drag', () => {
  // The threshold is about what the hand did, not what the content did.
  // Folding the scroll into it means holding a widget and wheel-scrolling a
  // few rows puts the threshold behind you, so the next pixel of pointer
  // movement arms a drag nobody began -- and releasing writes it.
  const onPlace = renderSurface();
  const body = widgetBody(onPlace.container, 'kpi');

  pointer(body, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });

  // Several rows of content pass under a still pointer.
  scrollTo(ROW_PITCH * 4);
  fireEvent.scroll(onPlace.container.firstChild as HTMLElement);

  // Then the hand twitches, well inside the threshold.
  pointer(body, 'pointermove', { clientX: 1, clientY: 1 });

  expect(screen.queryByTestId('canvas-drop-preview')).not.toBeInTheDocument();

  pointer(body, 'pointerup', { clientX: 1, clientY: 1 });

  expect(onPlace).not.toHaveBeenCalled();
});

test('the preview resolves auto-placed siblings from their stored layouts', () => {
  // The fixture elsewhere passes the same object as both `placements` and
  // `layouts`, so it cannot tell the two apart. They differ for an
  // auto-placed widget: its stored layout has no col/row at all, while its
  // placement is wherever the server put it. Resolving from the placement
  // pins it there, so it would not flow into the row a drag frees up.
  const stacked = {
    first: { col: 1, row: 1, colSpan: 24, rowSpan: 1 },
    second: { col: 1, row: 2, colSpan: 24, rowSpan: 1 },
  };
  const onPlace = jest.fn();
  const { container } = render(
    <CanvasGridSurface
      parentId="root"
      onMove={jest.fn()}
      onSwap={jest.fn()}
      childIds={['first', 'second']}
      columns={24}
      gap={16}
      rowUnit={40}
      placements={stacked}
      // Neither has a col or row of its own: the server auto-placed both.
      layouts={{ first: { rowSpan: 1 }, second: { rowSpan: 1 } }}
      constraints={{}}
      editable
      depth={0}
      onPlace={onPlace}
      renderNode={nodeId => <div>{`widget ${nodeId}`}</div>}
    />,
  );

  const rowOfNode = (nodeId: string) =>
    getComputedStyle(
      container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement,
    ).gridRow;

  expect(rowOfNode('second')).toBe('2/span 1');

  // Drag the first widget down to row 3, without releasing.
  const handle = handles('Move widget')[0];
  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(handle, 'pointermove', { clientX: 0, clientY: ROW_PITCH * 2 });

  // Row 1 is free, and an auto-placed widget flows into it.
  expect(rowOfNode('second')).toBe('1/span 1');
});

test("a nested widget's chrome steps down with its handles", () => {
  // The grip moves clear of the grip of the container around it, and the
  // menu beside it has to move with it. Leaving the menu at the top splits
  // what should read as one row -- visible as a nested widget whose dots sit
  // well below its own menu.
  const flat = renderSurface();
  const flatChrome = flat.container.querySelector(
    '.canvas-chrome',
  ) as HTMLElement;
  expect(
    getComputedStyle(
      flat.container.querySelector(
        '[data-test="canvas-drag-handle"]',
      ) as HTMLElement,
    ).top,
  ).toBe('0px');
  expect(flatChrome.className).toContain('canvas-chrome');

  const nested = renderSurface(underContainerHandles);
  const grips = nested.container.querySelectorAll(
    '[data-test="canvas-drag-handle"]',
  );
  const gripTopNested = getComputedStyle(grips[0] as HTMLElement).top;

  // Whatever the step is, the chrome takes the same one.
  expect(gripTopNested).toBe('36px');
  const rules = Array.from(document.styleSheets)
    .flatMap(sheet => {
      try {
        return Array.from(sheet.cssRules);
      } catch {
        return [];
      }
    })
    .map(rule => rule.cssText)
    .filter(text => text.includes('canvas-widget-controls'));

  expect(rules.join('\n')).toContain('top: 36px');
});

test('every widget shows its edges while a drag is running', () => {
  // A drop target you cannot see is one you cannot aim at, and revealing a
  // widget only once the pointer is near it tells you where it is just as
  // you arrive.
  const onPlace = renderSurface();
  const edges = (nodeId: string) =>
    getComputedStyle(
      onPlace.container.querySelector(
        `[data-node-id="${nodeId}"] .canvas-interactive`,
      ) as HTMLElement,
    ).boxShadow;

  expect(edges('trend')).toBe('');

  const handle = handles('Move widget')[0];
  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });

  // Including the widgets the pointer is nowhere near.
  expect(edges('trend')).not.toBe('');

  pointer(handle, 'pointerup', { clientX: 0, clientY: 0 });

  expect(edges('trend')).toBe('');
});

test('a resize that grows over a neighbour is not an offer to trade places', () => {
  // Exchanging places is what a *move* onto a widget means. Growing a widget
  // until it covers its neighbour is a resize, and the neighbour should be
  // pushed out of the way, not teleported to the slot this one still holds.
  const onSwap = jest.fn();
  const onPlace = renderSurface({ onSwap });

  // 'kpi' is 4 rows tall at row 1; eight more rows reaches 'trend' at row 9.
  const corner = corners(onPlace.container, 'se')[0];
  pointer(corner, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  pointer(corner, 'pointermove', { clientX: 0, clientY: ROW_PITCH * 8 });

  // On screen as well as in the write: a swap preview would put 'trend' in
  // row 1, which 'kpi' still occupies, and the release would then write
  // something else.
  expect(rowOf(onPlace.container, 'trend')).not.toContain('1/');

  pointer(corner, 'pointerup', { clientX: 0, clientY: ROW_PITCH * 8 });

  expect(onSwap).not.toHaveBeenCalled();
  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 1,
    row: 1,
    colSpan: 6,
    rowSpan: 12,
  });
});
