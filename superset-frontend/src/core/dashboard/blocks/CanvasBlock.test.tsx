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
  }: {
    children: React.ReactNode;
    compactType: string | null;
    allowOverlap?: boolean;
  }) => (
    <div
      data-test="rgl"
      data-compact-type={String(compactType)}
      data-allow-overlap={String(!!allowOverlap)}
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
