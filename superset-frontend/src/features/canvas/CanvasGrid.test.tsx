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
  revision: gridResult.revision,
  saving: false,
  place,
  dismissError: jest.fn(),
});

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
    screen.queryByRole('button', { name: 'Resize widget' }),
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
