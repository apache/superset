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
import {
  fireEvent,
  render,
  screen,
  within,
} from 'spec/helpers/testing-library';
import DashboardProvider from '../DashboardProvider';
import CanvasBlock from './CanvasBlock';

/**
 * Which renderer a container gets, and what a gesture in it commits.
 *
 * `react-grid-layout` is mocked down to the props that decide the two grid
 * modes apart. Everything about how it draws is its own business and covered
 * by its own tests; what matters here is that `free` reaches it with
 * compaction off and overlap allowed, and that `grid` does not — because
 * that single pair of props is the whole difference between "the space above
 * a block closes" and "a block stays where it was put".
 */
jest.mock('react-grid-layout/legacy', () => ({
  __esModule: true,
  default: ({
    children,
    compactType,
    allowOverlap,
    draggableCancel,
    resizeHandles,
  }: {
    children: React.ReactNode;
    compactType: string | null;
    allowOverlap?: boolean;
    draggableCancel?: string;
    resizeHandles?: string[];
  }) => (
    <div
      data-test="rgl"
      data-compact-type={String(compactType)}
      data-allow-overlap={String(!!allowOverlap)}
      data-draggable-cancel={draggableCancel ?? ''}
      data-resize-handles={(resizeHandles ?? []).join(',')}
    >
      {children}
    </div>
  ),
  WidthProvider: (component: unknown) => component,
}));
jest.mock('react-grid-layout/css/styles.css', () => ({}), { virtual: true });

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

const withMode = (mode?: 'grid' | 'free' | 'flex') => {
  const rootId = provider.getRoot().id;
  if (mode) {
    provider.updateLayout(rootId, { mode });
  }
  const first = provider.addBuildingBlock(rootId, 0, { type: 'markdown' });
  const second = provider.addBuildingBlock(rootId, 1, { type: 'markdown' });
  render(<CanvasBlock nodeId={rootId} />);
  return { rootId, first, second };
};

test('a grid compacts its children and does not let them overlap', () => {
  withMode('grid');

  const grid = screen.getByTestId('rgl');
  expect(grid).toHaveAttribute('data-compact-type', 'vertical');
  expect(grid).toHaveAttribute('data-allow-overlap', 'false');
});

test('the corner a block removes itself from is not also a resize handle', () => {
  withMode('grid');

  // react-grid-layout appends its handles after a block's own content, so the
  // north-east one landed on the remove control and took every click aimed at
  // it -- `elementFromPoint` at that button's centre returned the handle. A
  // handle nobody can grab is worse than no handle: the corner still looks
  // resizable, and answers a drag that starts a pixel to either side.
  expect(screen.getByTestId('rgl')).toHaveAttribute(
    'data-resize-handles',
    'se,sw,nw',
  );
});

test('a container that named no mode is drawn as a grid', () => {
  withMode();

  expect(screen.getByTestId('rgl')).toHaveAttribute(
    'data-compact-type',
    'vertical',
  );
});

test('a free canvas turns compaction off and allows overlap', () => {
  withMode('free');

  // `allowOverlap` is what makes a free canvas work. Passing `compactType`
  // null on its own leaves react-grid-layout's collision resolution running
  // with nothing to settle it, which is the runaway displacement recorded in
  // CanvasBlock — a free canvas must never reach that path.
  const grid = screen.getByTestId('rgl');
  expect(grid).toHaveAttribute('data-compact-type', 'null');
  expect(grid).toHaveAttribute('data-allow-overlap', 'true');
});

test('a flex container is not a grid at all', () => {
  withMode('flex');

  // A flex line has no cells to give react-grid-layout coordinates in, so
  // this is a different renderer rather than the same one configured
  // differently.
  expect(screen.getByTestId('flex-canvas')).toBeInTheDocument();
  expect(screen.queryByTestId('rgl')).not.toBeInTheDocument();
});

test('a flex child hands its block a definite box', () => {
  const rootId = provider.getRoot().id;
  provider.updateLayout(rootId, { mode: 'flex' });
  const id = provider.addBuildingBlock(rootId, 0, {
    type: 'markdown',
    layout: { rowSpan: 4 },
  });
  render(<CanvasBlock nodeId={rootId} />);

  // Every leaf block fills the box its placement wrapper gives it — a chart
  // measures that box to size its canvas, and markdown scrolls inside it. In
  // a grid, react-grid-layout supplies the box by cloning the block with an
  // explicit pixel width and height. A flex container positions its own
  // children, so it has to hand the same box down itself; without it the
  // block is content-height, the chart's measured height collapses, and
  // markdown taller than its share paints over the row beneath it.
  const block = within(screen.getByTestId(`flex-child-${id}`)).getByRole(
    'button',
    { name: 'markdown' },
  );
  expect(block).toHaveStyle({ width: '100%', height: '100%' });
});

test('a flex child is as tall as the same block in a grid', () => {
  const rootId = provider.getRoot().id;
  provider.updateLayout(rootId, { mode: 'flex' });
  const id = provider.addBuildingBlock(rootId, 0, {
    type: 'markdown',
    layout: { rowSpan: 4 },
  });
  render(<CanvasBlock nodeId={rootId} />);

  // react-grid-layout reserves the rows *and the gaps between them*
  // (`rowUnit * rowSpan + (rowSpan - 1) * gap`), so 4 rows of 32 with a gap
  // of 16 is 176px, not 128. Counting only the rows would make every block on
  // the canvas shrink the moment the mode changed.
  expect(screen.getByTestId(`flex-child-${id}`)).toHaveStyle({
    height: '176px',
  });
});

test('dragging one flex child onto another reorders them', () => {
  const { rootId, first, second } = withMode('flex');
  const data = new Map<string, string>();
  const dataTransfer = {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    effectAllowed: '',
  };

  fireEvent.dragStart(screen.getByTestId(`flex-child-${second}`), {
    dataTransfer,
  });
  fireEvent.drop(screen.getByTestId(`flex-child-${first}`), { dataTransfer });

  // Position in a flex container is order, so the gesture that arranges one
  // is a reorder — and it commits through the same moveBuildingBlock the AI
  // tools call.
  expect(provider.getNode(rootId)?.children).toEqual([second, first]);
});

test('a flex child dropped on itself changes nothing', () => {
  const { rootId, first, second } = withMode('flex');
  const data = new Map<string, string>();
  const dataTransfer = {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    effectAllowed: '',
  };

  fireEvent.dragStart(screen.getByTestId(`flex-child-${first}`), {
    dataTransfer,
  });
  fireEvent.drop(screen.getByTestId(`flex-child-${first}`), { dataTransfer });

  expect(provider.getNode(rootId)?.children).toEqual([first, second]);
});

/** A drag payload jsdom's synthetic events do not carry on their own. */
const paletteTransfer = (type: string) => {
  const data = new Map([['application/x-dashboard-building-block', type]]);
  return {
    types: [...data.keys()],
    getData: (key: string) => data.get(key) ?? '',
    setData: (key: string, value: string) => data.set(key, value),
    dropEffect: '',
    effectAllowed: '',
  };
};

test('dropping a palette block on a container places it there', () => {
  const { rootId } = withMode('grid');

  fireEvent.drop(screen.getByTestId('canvas-container'), {
    dataTransfer: paletteTransfer('markdown'),
  });

  const children = provider.getNode(rootId)?.children ?? [];
  expect(children).toHaveLength(3);
  expect(provider.getNode(children[2])?.type).toBe('markdown');
});

test('a drop into a flex container lands there too', () => {
  const { rootId } = withMode('flex');

  fireEvent.drop(screen.getByTestId('flex-canvas'), {
    dataTransfer: paletteTransfer('echarts'),
  });

  const children = provider.getNode(rootId)?.children ?? [];
  expect(provider.getNode(children[children.length - 1])?.type).toBe('echarts');
});

test('a drop carrying something else is not read as a block', () => {
  const { rootId } = withMode('grid');
  const before = provider.getNode(rootId)?.children?.length;

  fireEvent.drop(screen.getByTestId('canvas-container'), {
    dataTransfer: {
      types: ['text/plain'],
      getData: () => '',
      dropEffect: '',
      effectAllowed: '',
    },
  });

  // A private type rather than text/plain is what keeps a dragged file, or a
  // selection of text from another window, from placing a block.
  expect(provider.getNode(rootId)?.children?.length).toBe(before);
});

test('a placed block offers a way to remove it, and the root does not', () => {
  const { rootId, first } = withMode('grid');

  expect(screen.getByTestId(`block-remove-${first}`)).toBeInTheDocument();
  // Removing the root is refused by the provider, so offering the button
  // would be offering an error.
  expect(
    screen.queryByTestId(`block-remove-${rootId}`),
  ).not.toBeInTheDocument();
});

test('the remove control removes that block and nothing else', () => {
  const { rootId, first, second } = withMode('grid');

  fireEvent.click(screen.getByTestId(`block-remove-${first}`));

  expect(provider.getNode(rootId)?.children).toEqual([second]);
});

test('the grid is told not to start a drag from the remove control', () => {
  const { first } = withMode('grid');

  // react-grid-layout begins a drag on a press anywhere in the block it is
  // positioning, and the button sits inside that block. `draggableCancel` is
  // what it reads to exclude a region, so the selector and the attribute the
  // control carries have to agree — aiming at the bin would otherwise drag the
  // block it is attached to.
  const cancel = screen
    .getByTestId('rgl')
    .getAttribute('data-draggable-cancel');
  expect(cancel).toContain('[data-block-remove]');
  // On the control or above it: react-draggable matches the selector against
  // the pressed element and then walks its ancestors up to the grid item, so
  // the attribute excludes the whole region it is set on. The bin is the
  // shared `ActionButton`, which renders its own element and forwards no
  // arbitrary attributes to it — the region is what carries this.
  expect(
    screen.getByTestId(`block-remove-${first}`).closest('[data-block-remove]'),
  ).not.toBeNull();
});

test('clicking the remove control removes rather than selects', () => {
  const { first, second } = withMode('grid');

  fireEvent.click(screen.getByTestId(`block-remove-${second}`));

  // The wrapper selects on click and the button sits inside it. Without the
  // stop, removing a block would also try to select the thing just removed.
  expect(provider.getSelection()).toBeUndefined();
  expect(provider.getNode(second)).toBeUndefined();
  expect(provider.getNode(first)).toBeDefined();
});
