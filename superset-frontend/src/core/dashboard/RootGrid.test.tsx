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
import { act, fireEvent, render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from './DashboardProvider';
import RootGrid from './RootGrid';
import { registerBuiltInWidgets } from './registerBuiltInWidgets';
import {
  __getLastGridStackInstance,
  __resetGridStackMock,
} from '../../../spec/__mocks__/gridstackMock';

beforeAll(() => {
  registerBuiltInWidgets();
});

/**
 * `GridStack.init` measures the container it's given — meaningless in
 * jsdom, which has no layout engine — so every test that exercises the live
 * drop preview or an actual drop position needs a non-zero width to divide
 * columns into. 1200 is an arbitrary round number; nothing here asserts an
 * exact pixel value (that's `layoutStyle.test.ts`'s job), only that a ghost
 * appears/disappears and a drop lands in the right *cell*.
 */
const CONTAINER_WIDTH = 1200;

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
  __resetGridStackMock();
  // jsdom has no layout engine and does not implement this at all (not
  // even as a stub returning `null`) — every test that ends a drag has to
  // go through it (`findContainerIdAt`), whether or not that particular
  // test cares where it points.
  document.elementFromPoint = jest.fn().mockReturnValue(null);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: CONTAINER_WIDTH,
    height: 800,
    top: 0,
    left: 0,
    right: CONTAINER_WIDTH,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const mount = () => {
  const rootId = provider.getRoot().id;
  const first = provider.addWidget(rootId, 0, { type: 'markdown' });
  const second = provider.addWidget(rootId, 1, { type: 'markdown' });
  render(<RootGrid nodeId={rootId} />);
  return { rootId, first, second };
};

/** A drag payload jsdom's synthetic events do not carry on their own. */
const paletteTransfer = (type: string) => {
  const data = new Map([['application/x-dashboard-widget', type]]);
  return {
    types: [...data.keys()],
    getData: (key: string) => data.get(key) ?? '',
    setData: (key: string, value: string) => data.set(key, value),
    dropEffect: '',
    effectAllowed: '',
  };
};

test('the grid initializes with the root layout mapped onto GridStack options', () => {
  mount();

  const grid = __getLastGridStackInstance();
  expect(grid?.options).toMatchObject({
    column: 24,
    // 48/8: rowUnitPx(32) + gap(16), and gap(16)/2 — pinned explicitly since
    // getting either wrong silently regresses every widget's own height.
    cellHeight: 48,
    margin: 8,
    // Collision avoidance is always on regardless of this; `float: true`
    // only disables GridStack's own compaction pass, which would otherwise
    // fight `packChildLayout`'s own auto-placement for the same job.
    float: true,
    acceptWidgets: false,
    removable: false,
    animate: false,
    // GridStack's own default (`auto: true`) claims every `.grid-stack-item`
    // already in the DOM the moment `init` runs, with no `id` — and React
    // has already rendered every initially-mounted item by then. Left on,
    // every one of those items' `id` stays undefined forever, so every
    // future gesture-end commit (`readGestureItems`'s `!!node?.id` filter)
    // silently drops it and it springs back to its last position on the
    // very next drag or resize.
    auto: false,
  });
});

test('a widget resizes from all four corners', () => {
  mount();

  const grid = __getLastGridStackInstance();
  expect(grid?.options.resizable).toEqual({ handles: 'se, sw, nw, ne' });
});

test('the grid is told not to start a drag from the remove control, the overflow menu, a nested container, a flow resize grip, or a header control', () => {
  mount();

  // GridStack's own draggable engine matches this selector up the ancestors
  // of whatever was pressed — aiming at the bin would otherwise drag the
  // widget it is attached to, and dragging a chart out of a `tabs` widget
  // would instead drag the whole `tabs` widget on the root grid.
  const grid = __getLastGridStackInstance()!;
  const { cancel } = grid.options.draggable as { cancel: string };
  expect(cancel).toContain('[data-widget-remove]');
  expect(cancel).toContain('[data-widget-menu]');
  expect(cancel).toContain('[data-container-id]');
  expect(cancel).toContain('[data-widget-resize]');
  expect(cancel).toContain('[data-widget-header-control]');
});

test('every child is registered with GridStack at its packed position', () => {
  const { first, second } = mount();

  const grid = __getLastGridStackInstance();
  expect(grid?.makeWidget).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: first, x: 0, y: 0 }),
  );
  expect(grid?.makeWidget).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: second }),
  );
});

test('ending a drag on empty grid space commits every item’s settled position', () => {
  const { first, second } = mount();

  const grid = __getLastGridStackInstance()!;
  const el = grid
    .getGridItems()
    .find(item => item.gridstackNode?.id === first)!;
  el.gridstackNode = { id: first, x: 4, y: 2, w: 6, h: 3 };

  grid.__trigger('dragstop', el);

  expect(provider.getNode(first)?.layout).toMatchObject({
    col: 5,
    row: 3,
    colSpan: 6,
    rowSpan: 3,
  });
  // The untouched sibling still commits its own unchanged position — the
  // commit reads every item GridStack currently knows about, not just the
  // one the gesture ended on.
  expect(provider.getNode(second)?.layout).toBeDefined();
});

test('ending a resize on empty grid space commits the resized item’s new span', () => {
  const { first } = mount();

  const grid = __getLastGridStackInstance()!;
  const el = grid
    .getGridItems()
    .find(item => item.gridstackNode?.id === first)!;
  el.gridstackNode = { id: first, x: 0, y: 0, w: 12, h: 5 };

  grid.__trigger('resizestop', el);

  expect(provider.getNode(first)?.layout).toMatchObject({
    colSpan: 12,
    rowSpan: 5,
  });
});

test('ending a drag over a nested container reparents instead of committing a layout', () => {
  const { rootId, first } = mount();
  let collapsibleId = '';
  act(() => {
    collapsibleId = provider.addWidget(rootId, 1, {
      type: 'collapsible',
    });
  });

  const grid = __getLastGridStackInstance()!;
  const el = grid
    .getGridItems()
    .find(item => item.gridstackNode?.id === first)!;

  // Stubbed (see the `beforeEach` above) to return the collapsible's own
  // rendered container element, exactly what a real hit-test would find if
  // the drag actually ended over it.
  (document.elementFromPoint as jest.Mock).mockReturnValue(
    document.querySelector(`[data-container-id="${collapsibleId}"]`),
  );

  grid.__trigger('dragstop', el);

  expect(provider.getNode(collapsibleId)?.children).toContain(first);
  expect(provider.getNode(rootId)?.children).not.toContain(first);
});

test('ending a drag over its own container commits a layout instead of reparenting', () => {
  const { rootId, first } = mount();

  const grid = __getLastGridStackInstance()!;
  const el = grid
    .getGridItems()
    .find(item => item.gridstackNode?.id === first)!;
  el.gridstackNode = { id: first, x: 3, y: 1, w: 4, h: 2 };

  // The root grid's own surface also carries `data-container-id` — landing
  // back on the container the widget already belongs to must not be read as
  // a reparent onto itself.
  (document.elementFromPoint as jest.Mock).mockReturnValue(
    screen.getByTestId('grid-container'),
  );

  grid.__trigger('dragstop', el);

  expect(provider.getNode(rootId)?.children).toContain(first);
  expect(provider.getNode(first)?.layout).toMatchObject({
    col: 4,
    row: 2,
    colSpan: 4,
    rowSpan: 2,
  });
});

test('dropping a palette widget on the grid places it at the resolved cell', () => {
  const { rootId } = mount();

  fireEvent.dragOver(
    screen.getByTestId('grid-container').querySelector('.grid-stack')!,
    {
      dataTransfer: paletteTransfer('markdown'),
      clientX: 50,
      clientY: 10,
    },
  );

  fireEvent.drop(
    screen.getByTestId('grid-container').querySelector('.grid-stack')!,
    {
      dataTransfer: paletteTransfer('markdown'),
      clientX: 50,
      clientY: 10,
    },
  );

  const children = provider.getNode(rootId)?.children ?? [];
  expect(children).toHaveLength(3);
  expect(provider.getNode(children[2])?.type).toBe('markdown');
});

test('dropping a palette widget past the grid’s own rendered rows appends it at the end', () => {
  const { rootId } = mount();

  fireEvent.drop(screen.getByTestId('grid-container'), {
    dataTransfer: paletteTransfer('markdown'),
  });

  const children = provider.getNode(rootId)?.children ?? [];
  expect(children).toHaveLength(3);
  expect(provider.getNode(children[2])?.type).toBe('markdown');
});

test('a drop carrying something else is not read as a widget', () => {
  const { rootId } = mount();
  const before = provider.getNode(rootId)?.children?.length;

  fireEvent.drop(screen.getByTestId('grid-container'), {
    dataTransfer: {
      types: ['text/plain'],
      getData: () => '',
      dropEffect: '',
      effectAllowed: '',
    },
  });

  // A private type rather than text/plain is what keeps a dragged file, or a
  // selection of text from another window, from placing a widget.
  expect(provider.getNode(rootId)?.children?.length).toBe(before);
});

test('a placed widget offers a way to remove it, and the root does not', () => {
  const { rootId, first } = mount();

  expect(screen.getByTestId(`widget-remove-${first}`)).toBeInTheDocument();
  // Removing the root is refused by the provider, so offering the button
  // would be offering an error.
  expect(
    screen.queryByTestId(`widget-remove-${rootId}`),
  ).not.toBeInTheDocument();
});

test('the remove control removes that widget and nothing else', () => {
  const { rootId, first, second } = mount();

  fireEvent.click(screen.getByTestId(`widget-remove-${first}`));

  expect(provider.getNode(rootId)?.children).toEqual([second]);
});

test('clicking the remove control removes rather than selects', () => {
  const { first, second } = mount();

  fireEvent.click(screen.getByTestId(`widget-remove-${second}`));

  // The wrapper selects on click and the button sits inside it. Without the
  // stop, removing a widget would also try to select the thing just removed.
  expect(provider.getSelection()).toBeUndefined();
  expect(provider.getNode(second)).toBeUndefined();
  expect(provider.getNode(first)).toBeDefined();
});

test('unmounting a widget removes its widget from GridStack without touching the DOM', () => {
  const { rootId, first } = mount();

  act(() => provider.removeWidget(first));

  const grid = __getLastGridStackInstance();
  expect(grid?.removeWidget).toHaveBeenCalled();
  expect(provider.getNode(rootId)?.children).not.toContain(first);
});
