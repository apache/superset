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

import { ReactNode, useState } from 'react';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import CanvasGridSurface from './CanvasGridSurface';
import type { GridPlacement, SpanConstraints } from './types';

// jsdom lays nothing out, so the grid is told how wide it is: 1000px over 24
// columns with 16px gaps gives a 42.33px column pitch and a 56px row pitch.
const WIDTH = 1000;
const COL_PITCH = 632 / 24 + 16;
const ROW_PITCH = 56;

const placements: Record<string, GridPlacement> = {
  kpi: { col: 1, row: 1, colSpan: 6, rowSpan: 4 },
  trend: { col: 1, row: 5, colSpan: 24, rowSpan: 8 },
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
) => (
  <CanvasGridSurface
    childIds={childIds}
    columns={24}
    gap={16}
    rowUnit={40}
    placements={live}
    constraints={constraints}
    editable={editable}
    onPlace={onPlace}
    renderNode={renderNode}
  />
);

const renderSurface = ({
  editable = true,
  onPlace = jest.fn(),
  constraints = {} as Record<string, SpanConstraints>,
  live = placements,
  childIds = Object.keys(placements),
  renderNode,
}: {
  editable?: boolean;
  onPlace?: jest.Mock;
  constraints?: Record<string, SpanConstraints>;
  live?: Record<string, GridPlacement>;
  childIds?: string[];
  renderNode?: (nodeId: string) => ReactNode;
} = {}) => {
  const { rerender } = render(
    surface(live, editable, onPlace, constraints, childIds, renderNode),
  );
  return Object.assign(onPlace, {
    /** Simulate a write landing while a gesture is still live. */
    replace: (next: Record<string, GridPlacement>) =>
      rerender(
        surface(next, editable, onPlace, constraints, childIds, renderNode),
      ),
    /** Simulate editing being switched off, e.g. a publish starting. */
    setEditable: (next: boolean) =>
      rerender(surface(live, next, onPlace, constraints, childIds, renderNode)),
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
  screen.getAllByRole('button', { name });

beforeAll(() => {
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

  drag(handles('Resize widget')[0], COL_PITCH * 3, ROW_PITCH);

  expect(onPlace).toHaveBeenCalledWith('kpi', {
    col: 1,
    row: 1,
    colSpan: 9,
    rowSpan: 5,
  });
});

test('a resize stops at the span limits the widget declares', () => {
  const onPlace = renderSurface({ constraints: { kpi: { maxColSpan: 8 } } });

  drag(handles('Resize widget')[0], COL_PITCH * 10, 0);

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

  fireEvent.keyDown(handles('Resize widget')[0], { key: 'ArrowDown' });

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
    screen.queryByRole('button', { name: 'Resize widget' }),
  ).not.toBeInTheDocument();
});

test('the drop preview warns while it covers another widget', () => {
  renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  // 'kpi' is 6x4 at row 1; four rows down puts it on 'trend' at row 5.
  pointer(handle, 'pointermove', { clientX: 0, clientY: ROW_PITCH * 4 });

  const preview = screen.getByTestId('canvas-drop-preview');
  expect(preview).toHaveAttribute('data-colliding', 'true');
  expect(preview).toHaveAttribute('title', 'This overlaps another widget');
});

test('the drop preview stays neutral over free space', () => {
  renderSurface();
  const handle = handles('Move widget')[0];

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  // Straight right, staying on row 1 where nothing else sits.
  pointer(handle, 'pointermove', { clientX: COL_PITCH * 8, clientY: 0 });

  const preview = screen.getByTestId('canvas-drop-preview');
  expect(preview).toHaveAttribute('data-colliding', 'false');
  expect(preview).not.toHaveAttribute('title');
});

test('a resize that grows onto a neighbour warns too', () => {
  renderSurface();
  const handle = handles('Resize widget')[0];

  pointer(handle, 'pointerdown', { button: 0, clientX: 0, clientY: 0 });
  // Grow 'kpi' four rows taller, reaching into 'trend'.
  pointer(handle, 'pointermove', { clientX: 0, clientY: ROW_PITCH * 4 });

  expect(screen.getByTestId('canvas-drop-preview')).toHaveAttribute(
    'data-colliding',
    'true',
  );
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

test('a widget with no resolved placement renders, with no handles', () => {
  // Still a child of the grid, so it stays mounted; it just has nowhere to be
  // dragged from, so it gets no handles while its sibling keeps its own.
  renderSurface({
    live: { trend: placements.trend },
    childIds: ['kpi', 'trend'],
  });

  expect(screen.getByText('widget kpi')).toBeInTheDocument();
  expect(handles('Move widget')).toHaveLength(1);
  expect(handles('Resize widget')).toHaveLength(1);
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
    row: 6,
    colSpan: 24,
    rowSpan: 8,
  });
});
