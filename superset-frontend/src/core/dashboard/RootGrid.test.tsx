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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from './DashboardProvider';
import RootGrid from './RootGrid';

/**
 * What a gesture on the grid commits.
 *
 * `react-grid-layout` is mocked down to the props RootGrid feeds it. Everything
 * about how it draws is its own business and covered by its own tests; what
 * matters here is that RootGrid always compacts and never allows overlap.
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

const mount = () => {
  const rootId = provider.getRoot().id;
  const first = provider.addBuildingBlock(rootId, 0, { type: 'markdown' });
  const second = provider.addBuildingBlock(rootId, 1, { type: 'markdown' });
  render(<RootGrid nodeId={rootId} />);
  return { rootId, first, second };
};

test('a grid compacts its children and does not let them overlap', () => {
  mount();

  const grid = screen.getByTestId('rgl');
  expect(grid).toHaveAttribute('data-compact-type', 'vertical');
  expect(grid).toHaveAttribute('data-allow-overlap', 'false');
});

test('a block resizes from all four corners', () => {
  mount();

  // Used to exclude the north-east corner, which sat under the remove
  // control -- react-grid-layout appends its handles after a block's own
  // content, so a handle there took every click aimed at the button beneath
  // it. The single card-wide inset (see `BuildingBlockView`) moved the
  // button far enough from the true corner that both now fit.
  expect(screen.getByTestId('rgl')).toHaveAttribute(
    'data-resize-handles',
    'se,sw,nw,ne',
  );
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
  const { rootId } = mount();

  fireEvent.drop(screen.getByTestId('grid-container'), {
    dataTransfer: paletteTransfer('markdown'),
  });

  const children = provider.getNode(rootId)?.children ?? [];
  expect(children).toHaveLength(3);
  expect(provider.getNode(children[2])?.type).toBe('markdown');
});

test('a drop carrying something else is not read as a block', () => {
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
  // selection of text from another window, from placing a block.
  expect(provider.getNode(rootId)?.children?.length).toBe(before);
});

test('a placed block offers a way to remove it, and the root does not', () => {
  const { rootId, first } = mount();

  expect(screen.getByTestId(`block-remove-${first}`)).toBeInTheDocument();
  // Removing the root is refused by the provider, so offering the button
  // would be offering an error.
  expect(
    screen.queryByTestId(`block-remove-${rootId}`),
  ).not.toBeInTheDocument();
});

test('the remove control removes that block and nothing else', () => {
  const { rootId, first, second } = mount();

  fireEvent.click(screen.getByTestId(`block-remove-${first}`));

  expect(provider.getNode(rootId)?.children).toEqual([second]);
});

test('the grid is told not to start a drag from the remove control', () => {
  const { first } = mount();

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

test('the grid is also told not to start a drag from a nested block resize handle', () => {
  mount();

  // The same guard as the remove control, for the same reason — a `tabs`
  // block sitting on this grid renders its own resize handle (see
  // `TabsBlock`'s `FlowItem`) for a block flowed into one of its panes, and
  // without this, resizing that block also drags the `tabs` item holding it.
  const cancel = screen
    .getByTestId('rgl')
    .getAttribute('data-draggable-cancel');
  expect(cancel).toContain('[data-block-resize]');
});

test('clicking the remove control removes rather than selects', () => {
  const { first, second } = mount();

  fireEvent.click(screen.getByTestId(`block-remove-${second}`));

  // The wrapper selects on click and the button sits inside it. Without the
  // stop, removing a block would also try to select the thing just removed.
  expect(provider.getSelection()).toBeUndefined();
  expect(provider.getNode(second)).toBeUndefined();
  expect(provider.getNode(first)).toBeDefined();
});
