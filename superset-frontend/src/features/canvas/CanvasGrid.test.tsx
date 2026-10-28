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
import type { canvas as canvasApi } from '@apache-superset/core';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { canvas } from 'src/core';
import CanvasGrid, { emptyScopeValues, ScopeValues } from './CanvasGrid';
import { CanvasDefinitionResult, CanvasSettings } from './types';
import type { CanvasLayout } from './useCanvasLayout';

const settings: CanvasSettings = {
  refresh: { interval: 0, stagger: 0, exempt: [] },
  colors: { scheme: 'supersetColors', labelColors: { EMEA: '#123456' } },
  display: { showTimestamps: true },
  crossFilters: { enabled: true },
};

const result: CanvasDefinitionResult = {
  version: 1,
  revision: 3,
  definition: {
    version: 1,
    root: {
      layout: { columns: 24, gap: 16, rowUnit: 40 },
      children: ['f', 'g', 'lost', 'odd', 'unknown'],
    },
    nodes: {
      f: { widgetId: 'w-filter', layout: {} },
      g: { widgetId: 'w-group', layout: {}, children: ['c1'] },
      c1: {
        widgetType: 'test.chart',
        schemaVersion: 1,
        props: { title: 'Revenue' },
        layout: { colSpan: 6 },
      },
      lost: { widgetId: 'w-gone', layout: {} },
      odd: { widgetId: 'w-odd', layout: {} },
      unknown: { widgetId: 'w-unknown', layout: {} },
    },
    interactions: { filters: {}, crossFilters: {}, customizations: {} },
    settings,
  },
  filterScopes: { f: ['c1'] },
  crossFilterScopes: { odd: ['c1'] },
  customizationScopes: {},
  placements: {
    f: { col: 1, row: 1, colSpan: 24, rowSpan: 1 },
    g: { col: 1, row: 2, colSpan: 24, rowSpan: 4 },
    lost: { col: 1, row: 6, colSpan: 12, rowSpan: 1 },
    odd: { col: 13, row: 6, colSpan: 12, rowSpan: 1 },
    unknown: { col: 1, row: 7, colSpan: 24, rowSpan: 1 },
    c1: { col: 1, row: 1, colSpan: 6, rowSpan: 1 },
  },
  // Every node auto-placed, as the stored layouts above are.
  layouts: {
    f: {},
    g: {},
    lost: {},
    odd: { colSpan: 12 },
    unknown: {},
    c1: { colSpan: 6 },
  },
  childOrder: {
    root: ['f', 'g', 'lost', 'odd', 'unknown'],
    g: ['c1'],
  },
  widgetTypes: {
    f: 'test.filter',
    g: 'test.group',
    c1: 'test.chart',
    odd: 'test.odd',
    unknown: 'test.unknown',
  },
  gridColumns: { g: 12 },
  layoutConstraints: { c1: { minColSpan: 2 } },
  canEdit: false,
};

const Chart = ({
  props,
  filters,
  crossFilters,
  colors,
  showTimestamp,
  refreshKey,
}: canvasApi.CanvasWidgetProps) => (
  <div>
    <span>{`chart ${props?.title} filters=${JSON.stringify(filters)}`}</span>
    <span>{`cross=${JSON.stringify(crossFilters)}`}</span>
    <span>{`colors=${colors.scheme} timestamp=${showTimestamp} refresh=${refreshKey}`}</span>
  </div>
);
const CrossSource = ({ setCrossFilter }: canvasApi.CanvasWidgetProps) => (
  <button type="button" onClick={() => setCrossFilter('France')}>
    cross filter
  </button>
);
const Filter = ({ setFilterValue }: canvasApi.CanvasWidgetProps) => (
  <button type="button" onClick={() => setFilterValue('EMEA')}>
    set filter
  </button>
);
const Group = ({ renderGrid }: canvasApi.CanvasWidgetProps) => (
  <section aria-label="group">{renderGrid()}</section>
);

const registrations = [
  canvas.registerWidgetRenderer('test.chart', Chart),
  canvas.registerWidgetRenderer('test.filter', Filter),
  canvas.registerWidgetRenderer('test.group', Group),
  canvas.registerWidgetRenderer('test.odd', CrossSource),
];

const layoutOf = (
  gridResult: CanvasDefinitionResult,
  place = jest.fn(),
): CanvasLayout => ({
  placements: gridResult.placements,
  layouts: gridResult.layouts,
  childOrder: gridResult.childOrder,
  layoutConstraints: gridResult.layoutConstraints,
  revision: gridResult.revision,
  saving: false,
  place,
  move: jest.fn(),
  swap: jest.fn(),
  dismissError: jest.fn(),
});

/** A layout with fields overridden, for the acknowledged-state reads. */
const layoutWith = (
  gridResult: CanvasDefinitionResult,
  overrides: Partial<CanvasLayout>,
): CanvasLayout => ({ ...layoutOf(gridResult), ...overrides });

const renderGrid = (
  values: ScopeValues = emptyScopeValues(),
  onValueChange = jest.fn(),
  gridResult: CanvasDefinitionResult = result,
  place = jest.fn(),
  editable = false,
) =>
  render(
    <CanvasGrid
      canvasId={7}
      result={gridResult}
      values={values}
      onValueChange={onValueChange}
      refreshKeys={{ c1: 2 }}
      layout={layoutOf(gridResult, place)}
      editable={editable}
    />,
  );
afterAll(() => registrations.forEach(registration => registration.dispose()));

test('renders widgets through their renderers, nested in grid containers', () => {
  renderGrid();

  expect(screen.getByRole('region', { name: 'group' })).toHaveTextContent(
    'chart Revenue filters=[]',
  );
  expect(
    screen.getByText('colors=supersetColors timestamp=true refresh=2'),
  ).toBeInTheDocument();
});

test('shows placeholders for unavailable widgets and unregistered types', () => {
  renderGrid();

  expect(screen.getByText('This widget is unavailable')).toBeInTheDocument();
  expect(
    screen.getByText('No renderer for widget type "test.unknown"'),
  ).toBeInTheDocument();
});

test('filter values reach the nodes in the filter scope', () => {
  const onValueChange = jest.fn();
  renderGrid({ ...emptyScopeValues(), filter: { f: 'EMEA' } }, onValueChange);

  expect(
    screen.getByText(
      'chart Revenue filters=[{"filterNodeId":"f","value":"EMEA"}]',
    ),
  ).toBeInTheDocument();

  screen.getByRole('button', { name: 'set filter' }).click();

  expect(onValueChange).toHaveBeenCalledWith('filter', 'f', 'EMEA');
});

test('cross-filter values reach the nodes in the source scope', () => {
  const onValueChange = jest.fn();
  renderGrid(
    { ...emptyScopeValues(), crossFilter: { odd: 'France' } },
    onValueChange,
  );

  expect(
    screen.getByText('cross=[{"filterNodeId":"odd","value":"France"}]'),
  ).toBeInTheDocument();
  screen.getByRole('button', { name: 'cross filter' }).click();
  expect(onValueChange).toHaveBeenCalledWith('crossFilter', 'odd', 'France');
});

test('setting a cross-filter does nothing while cross-filters are off', () => {
  const onValueChange = jest.fn();
  const off: CanvasDefinitionResult = {
    ...result,
    definition: {
      ...result.definition,
      settings: { ...settings, crossFilters: { enabled: false } },
    },
  };
  renderGrid(emptyScopeValues(), onValueChange, off);

  screen.getByRole('button', { name: 'cross filter' }).click();

  expect(onValueChange).not.toHaveBeenCalled();
});

test('a canvas that is not editable gets no drag or resize handles', () => {
  renderGrid();

  expect(
    screen.queryByRole('button', { name: 'Move widget' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /^Resize widget from/ }),
  ).not.toBeInTheDocument();
});

test('an editable canvas gets a handle per placed widget', () => {
  renderGrid(emptyScopeValues(), jest.fn(), result, jest.fn(), true);

  // Every node with a resolved placement, on the root grid and inside the
  // nested group, is draggable and resizable.
  expect(screen.getAllByRole('button', { name: 'Move widget' })).toHaveLength(
    Object.keys(result.placements).length,
  );
  // Four corners each.
  expect(
    screen.getAllByRole('button', { name: /^Resize widget from/ }),
  ).toHaveLength(Object.keys(result.placements).length * 4);
});

/**
 * jsdom carries none of the properties a gesture needs on its own
 * `PointerEvent`, so these are built on `MouseEvent` with the pointer id added
 * -- the same shape `CanvasGridSurface.test.tsx` uses.
 */
class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: MouseEventInit = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = 1;
  }
}

const dragRight = (handle: HTMLElement, dx: number) =>
  [
    new TestPointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 }),
    new TestPointerEvent('pointermove', { clientX: dx, clientY: 0 }),
    new TestPointerEvent('pointerup', { clientX: dx, clientY: 0 }),
  ].forEach(event => fireEvent(handle, event));

beforeAll(() => {
  // jsdom lays nothing out, so every grid is told it is 1000px wide.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 1000,
  });
  // jsdom has no pointer capture; the gesture only needs it not to throw.
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
});

test('a nested grid resizes against its own column count, not the root', () => {
  // 'c1' sits in group 'g', which declares 12 columns against the root's 24.
  // Handing the root count to the nested surface would let 'c1' grow to 24,
  // and would halve the column pitch so the same drag reported twice the
  // movement.
  const place = jest.fn();
  renderGrid(emptyScopeValues(), jest.fn(), result, place, true);

  const group = screen.getByRole('region', { name: 'group' });
  dragRight(group.querySelector('[data-corner="se"]') as HTMLElement, 2000);

  expect(place).toHaveBeenCalledWith('c1', {
    col: 1,
    row: 1,
    colSpan: 12,
    rowSpan: 1,
  });
});

test("a nested resize honours the widget's declared minimum span", () => {
  // 'c1' declares minColSpan 2 and starts at 6 of the group's 12 columns.
  // Dragging its corner well past the left edge must stop at 2, not 1: this
  // is what fails if `layoutConstraints` never reaches the nested surface.
  const place = jest.fn();
  renderGrid(emptyScopeValues(), jest.fn(), result, place, true);

  const group = screen.getByRole('region', { name: 'group' });
  // The bottom-right corner, dragged left: the span shrinks while the origin
  // stays put, so it is the minimum that stops it.
  dragRight(group.querySelector('[data-corner="se"]') as HTMLElement, -2000);

  expect(place).toHaveBeenCalledWith('c1', {
    col: 1,
    row: 1,
    colSpan: 2,
    rowSpan: 1,
  });
});

test('a press inside a group drags the widget, not the group', () => {
  // A deferred body press does not stop propagation -- a click has to reach
  // the widget -- so it bubbles to the nested grid and to the root one. Both
  // would start a gesture, the outer one would win the pointer, and the
  // group would move instead of the chart.
  const place = jest.fn();
  renderGrid(emptyScopeValues(), jest.fn(), result, place, true);

  const group = screen.getByRole('region', { name: 'group' });
  const inner = group.querySelector('.canvas-interactive') as HTMLElement;

  // Downwards: the group is full width, so a sideways drag cannot move it and
  // would never commit, hiding the very thing this guards.
  [
    new TestPointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 }),
    new TestPointerEvent('pointermove', { clientX: 0, clientY: 112 }),
    new TestPointerEvent('pointerup', { clientX: 0, clientY: 112 }),
  ].forEach(event => fireEvent(inner, event));

  expect(place).toHaveBeenCalledTimes(1);
  expect(place.mock.calls[0][0]).toBe('c1');
});

test("the acknowledged reading order wins over the definition's", () => {
  // A `place` reorders the parent's children server-side, and the fetched
  // definition keeps the old order until the next poll. Reading it from the
  // definition would restore the stale order right after a drop.
  render(
    <CanvasGrid
      canvasId={7}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={layoutWith(result, {
        // The definition's root order starts 'f', 'g'; this swaps them.
        childOrder: { ...result.childOrder, root: ['g', 'f', 'lost'] },
      })}
      editable={false}
    />,
  );

  // Direct children of the root grid only: a nested grid's own children sit
  // inside their container and would interleave with them.
  const rendered = Array.from(
    document.querySelectorAll(
      '[data-test="canvas-grid"] > [data-test="canvas-grid-surface"] > [data-node-id]',
    ),
  ).map(node => node.getAttribute('data-node-id'));

  expect(rendered).toEqual(['g', 'f', 'lost']);
});

test('the acknowledged span limits are what a resize clamps to', () => {
  // A container's row minimum follows the rows its children occupy, so a
  // write moves it. Clamping to the definition's limits would let the user
  // shrink a container past a minimum the server has already raised.
  const place = jest.fn();
  render(
    <CanvasGrid
      canvasId={7}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={layoutWith(result, {
        place,
        // 'c1' spans 6 of the group's 12 columns; this forbids going below 5.
        layoutConstraints: { c1: { minColSpan: 5 } },
      })}
      editable
    />,
  );

  const group = screen.getByRole('region', { name: 'group' });
  dragRight(group.querySelector('[data-corner="se"]') as HTMLElement, -2000);

  expect(place).toHaveBeenCalledWith('c1', {
    col: 1,
    row: 1,
    colSpan: 5,
    rowSpan: 1,
  });
});

test('a widget dragged out of a group moves into the grid it was dropped on', () => {
  // A drag only ever sent `place`, which changes a widget's layout inside the
  // container it already lives in -- so dropping a widget below its group
  // just grew the group. The drop now resolves which grid is under the
  // pointer and, when that is a different one, reparents the widget instead.
  const place = jest.fn();
  const move = jest.fn();
  const { container } = render(
    <CanvasGrid
      canvasId={7}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={layoutWith(result, { place, move })}
      editable
    />,
  );

  // Two grids: the root, and the one inside the group.
  const grids = container.querySelectorAll('[data-test="canvas-grid-surface"]');
  expect(grids).toHaveLength(2);
  const [root, inner] = Array.from(grids) as HTMLElement[];

  // jsdom lays nothing out, so say where each grid is. The root fills the
  // page; the group's grid is the band across its middle.
  const box = (el: HTMLElement, top: number, bottom: number) =>
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top,
        right: 1000,
        bottom,
        width: 1000,
        height: bottom - top,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }),
    });
  box(root, 0, 800);
  box(inner, 200, 400);

  // 'c1' lives in the group. Drag it out, down into the root grid.
  const group = screen.getByRole('region', { name: 'group' });
  const handle = group.querySelector(
    '[data-test="canvas-drag-handle"]',
  ) as HTMLElement;

  fireEvent(
    handle,
    new TestPointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 300,
    }),
  );
  // Well below the group's band, so the root grid is under the pointer.
  fireEvent(
    handle,
    new TestPointerEvent('pointermove', { clientX: 100, clientY: 700 }),
  );
  fireEvent(
    handle,
    new TestPointerEvent('pointerup', { clientX: 100, clientY: 700 }),
  );

  // Reparented, not merely re-laid-out.
  expect(place).not.toHaveBeenCalled();
  expect(move).toHaveBeenCalledTimes(1);
  const [nodeId, parent, index, placement] = move.mock.calls[0];
  expect(nodeId).toBe('c1');
  expect(parent).toBe('root');
  expect(typeof index).toBe('number');
  // Landed in the root's 24 columns, not the group's 12.
  expect(placement.colSpan).toBeLessThanOrEqual(24);
  expect(placement.row).toBeGreaterThan(0);
});

test('a widget dragged into a group moves into it', () => {
  // The other direction: a widget that lives on the root grid, dropped over
  // a container's grid, belongs to that container afterwards.
  const place = jest.fn();
  const move = jest.fn();
  const { container } = render(
    <CanvasGrid
      canvasId={7}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={layoutWith(result, { place, move })}
      editable
    />,
  );

  const grids = container.querySelectorAll('[data-test="canvas-grid-surface"]');
  const [root, inner] = Array.from(grids) as HTMLElement[];
  const box = (el: HTMLElement, top: number, bottom: number) =>
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top,
        right: 1000,
        bottom,
        width: 1000,
        height: bottom - top,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }),
    });
  box(root, 0, 800);
  box(inner, 200, 400);

  // 'lost' sits on the root grid. Drag it up into the group's band.
  const node = container.querySelector(
    '[data-node-id="lost"] [data-test="canvas-drag-handle"]',
  ) as HTMLElement;

  fireEvent(
    node,
    new TestPointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 700,
    }),
  );
  fireEvent(
    node,
    new TestPointerEvent('pointermove', { clientX: 100, clientY: 300 }),
  );
  fireEvent(
    node,
    new TestPointerEvent('pointerup', { clientX: 100, clientY: 300 }),
  );

  expect(place).not.toHaveBeenCalled();
  expect(move).toHaveBeenCalledTimes(1);
  expect(move.mock.calls[0][1]).toBe('g');
});

test('a container stays aimable while the grid around it reflows', () => {
  // The grid a widget starts in reflows as the drag previews it, pushing a
  // container along with everything else -- out from under the pointer,
  // before the pointer can be found to be over it. The drag then never
  // notices the container, keeps previewing the widget beside it, and the
  // container stays out of reach: dropping onto a group only ever shoved the
  // whole group down. Pinned at the positions they held when the drag began,
  // the targets stay where the user aimed.
  const move = jest.fn();
  const { container } = render(
    <CanvasGrid
      canvasId={7}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={layoutWith(result, { move })}
      editable
    />,
  );

  const grids = container.querySelectorAll('[data-test="canvas-grid-surface"]');
  const [root, inner] = Array.from(grids) as HTMLElement[];
  let innerTop = 200;
  const rect = (left: number, top: number, right: number, bottom: number) => ({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  });
  Object.defineProperty(root, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect(0, 0, 1000, 800),
  });
  // The group runs away as soon as the drag starts, as a live reflow does.
  Object.defineProperty(inner, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect(0, innerTop, 1000, innerTop + 200),
  });

  const node = container.querySelector(
    '[data-node-id="lost"] [data-test="canvas-drag-handle"]',
  ) as HTMLElement;

  fireEvent(
    node,
    new TestPointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 700,
    }),
  );
  // Arming pins the geometry; the group then moves far out of the way.
  fireEvent(
    node,
    new TestPointerEvent('pointermove', { clientX: 100, clientY: 650 }),
  );
  innerTop = 5000;
  fireEvent(
    node,
    new TestPointerEvent('pointermove', { clientX: 100, clientY: 300 }),
  );
  fireEvent(
    node,
    new TestPointerEvent('pointerup', { clientX: 100, clientY: 300 }),
  );

  // Aimed at where the group was, so that is where it lands.
  expect(move).toHaveBeenCalledTimes(1);
  expect(move.mock.calls[0][1]).toBe('g');
});
