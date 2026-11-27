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
  CHART_DATA_ENDPOINT,
  DeepBody,
  Harness,
  S4_LEVELS,
  agentLevel,
  collapseFromMainButton,
  holdDeep,
  deepKeyboardChart,
  deepLevelOf,
  depthOf,
  describeDeep,
  fourLevelProps,
  gridsAtDepth,
  interactionLevel,
  pressTab,
  queueLevel,
  queueRows,
  routeDeep,
  segmentLevel,
  setObservedHeight,
  tick,
  toggleOf,
  userEvent,
} from '../../test/treeTableChartTestUtils';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@superset-ui/core/spec';
import fetchMock from 'fetch-mock';
import TreeTableChart from './TreeTableChart';

const deepRequests = () =>
  fetchMock.callHistory
    .calls(CHART_DATA_ENDPOINT)
    .map(call => JSON.parse(call.options.body as string) as DeepBody);

const deepBatchBodies = () =>
  deepRequests().filter(
    body =>
      body.queries.length > 1 ||
      body.queries[0].metrics.length ||
      body.queries[0].row_offset,
  );

test('four levels: expanding each level batches its rows, and an agent can have no segments', async () => {
  routeDeep();
  render(<TreeTableChart {...fourLevelProps()} />);
  fireEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  expect(screen.getByText('L')).toBeInTheDocument();
  fireEvent.click(toggleOf('P'));
  await screen.findByText('2 Interactions');
  expect(screen.getByText('i1 voice')).toBeInTheDocument();
  expect(screen.queryByText('i3 voice')).toBeNull();
  fireEvent.click(toggleOf('i1 voice'));
  await screen.findByText('2 Segments');
  expect(
    screen.getByRole('group', { name: 'Interaction details', hidden: true }),
  ).toBeInTheDocument();
  expect(screen.getByText('i1 phone')).toBeInTheDocument();
  fireEvent.click(toggleOf('i1 no 0'));
  const details = screen.getByRole('group', {
    name: 'Segment details',
    hidden: true,
  });
  expect(depthOf(details)).toBe(4);
  expect(deepBatchBodies().map(deepLevelOf)).toEqual([1, 2, 3]);
  expect(
    deepBatchBodies()[1].queries[0].filters.filter(
      filter => filter.op === 'IN',
    ),
  ).toEqual([
    { col: 'queue', op: 'IN', val: ['Q1'] },
    { col: 'agent', op: 'IN', val: ['L', 'P'] },
  ]);
  fireEvent.click(toggleOf('L'));
  await screen.findByText('i4 voice');
  expect(deepBatchBodies()).toHaveLength(3);
  fireEvent.click(toggleOf('i4 voice'));
  await screen.findByText('No Segments');
  expect(deepBatchBodies()).toHaveLength(4);
});

test('four levels: the same agent under another queue keeps its own rows', async () => {
  routeDeep();
  render(<TreeTableChart {...fourLevelProps()} />);
  fireEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  fireEvent.click(toggleOf('P'));
  await screen.findByText('i1 voice');
  expect(screen.queryByText('i3 voice')).toBeNull();
  fireEvent.click(toggleOf('Q2'));
  await waitFor(() => expect(screen.getAllByText('P')).toHaveLength(2));
  fireEvent.click(
    screen
      .getAllByText('P')[1]
      .closest('[role="row"]')!
      .querySelector<HTMLElement>('[col-id="tree_table_expand"] button')!,
  );
  await screen.findByText('i3 voice');
  expect(screen.getByText('i1 voice')).toBeInTheDocument();
  expect(screen.getAllByText('1 Interaction').length).toBeGreaterThan(0);
  expect(deepBatchBodies().map(deepLevelOf)).toEqual([1, 2, 2]);
});

test('four levels: every child table shows +/- when its rows can open (a level below or detail fields)', async () => {
  routeDeep();
  const { container } = render(
    <TreeTableChart
      {...fourLevelProps({
        levels: [
          queueLevel,
          agentLevel,
          interactionLevel,
          { ...segmentLevel, detail_fields: [] },
        ],
      })}
    />,
  );
  await userEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  await userEvent.click(toggleOf('P'));
  await screen.findByText('2 Interactions');
  await userEvent.click(toggleOf('i1 voice'));
  await screen.findByText('2 Segments');
  const grids = [...container.querySelectorAll('[data-themed-ag-grid]')];
  const expandHeaders = (grid: Element) =>
    [...grid.querySelectorAll('[role="columnheader"]')].filter(
      header =>
        header.closest('[data-themed-ag-grid]') === grid &&
        header.getAttribute('col-id') === 'tree_table_expand',
    ).length;
  expect(grids.map(expandHeaders)).toEqual([1, 1, 1, 0]);
});

test('partial menu picks derive the label and the deepest pick sets Collapse all', async () => {
  routeDeep();
  render(
    <TreeTableChart
      {...fourLevelProps({
        levels: S4_LEVELS.slice(0, 3),
        data: [{ queue: 'Q1' }],
        rowcount: 1,
      })}
    />,
  );
  const button = screen.getByRole('button', { name: 'Expand all' });
  const arrow = screen.getByRole('button', { name: 'Expand all to level' });
  await userEvent.click(arrow);
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Expand to Queues' }),
  );
  expect(button).toHaveTextContent('Expand all');
  await screen.findByText('2 Agents');
  expect(button).toHaveTextContent('Expand all');
  await userEvent.click(arrow);
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Expand to Interactions' }),
  );
  expect(button).toHaveTextContent('Collapse all');
  await screen.findByText('2 Interactions');
  expect(button).toHaveTextContent('Collapse all');
});

test.each([
  ['Interactions', 3, 9, 0],
  ['Segments', 4, 14, 5],
])(
  'four levels: Expand all to %s opens every row down to it with one request per level and one copy of each area; Collapse all sends nothing; opening again uses the cache',
  async (pick, picked, areaCount, segmentDetails) => {
    routeDeep();
    const { container } = render(<TreeTableChart {...fourLevelProps()} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Expand all to level' }),
    );
    expect(
      screen.getAllByRole('menuitem').map(option => option.textContent),
    ).toEqual([
      'Expand to Queues',
      'Expand to Agents',
      'Expand to Interactions',
      'Expand to Segments',
    ]);
    await userEvent.click(
      await screen.findByRole('menuitem', { name: `Expand to ${pick}` }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole('group', {
          name: 'Interaction details',
          hidden: true,
        }),
      ).toHaveLength(4),
    );
    await waitFor(() =>
      expect(screen.getAllByText(/\d+ Segments?|No Segments/)).toHaveLength(4),
    );
    if (segmentDetails)
      await waitFor(() =>
        expect(
          screen.getAllByRole('group', {
            name: 'Segment details',
            hidden: true,
          }),
        ).toHaveLength(segmentDetails),
      );
    await tick();
    const areas = container.querySelectorAll('.tree-table-area-status');
    expect(areas).toHaveLength(areaCount);
    expect(
      [...areas].filter(area =>
        area.closest('.ag-grid-pinned-left-cells, .ag-grid-pinned-right-cells'),
      ),
    ).toHaveLength(0);
    expect(
      screen.queryAllByRole('group', { name: 'Segment details', hidden: true }),
    ).toHaveLength(segmentDetails);
    expect(screen.getAllByText('i1 voice')).toHaveLength(1);
    expect(deepBatchBodies().map(deepLevelOf)).toEqual([1, 2, 3]);
    expect(picked).toBeGreaterThan(0);
    await collapseFromMainButton();
    await waitFor(() =>
      expect(
        container.querySelectorAll('.tree-table-area-status'),
      ).toHaveLength(0),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Expand all to level' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: `Expand to ${pick}` }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole('group', {
          name: 'Interaction details',
          hidden: true,
        }),
      ).toHaveLength(4),
    );
    await tick();
    expect(deepBatchBodies()).toHaveLength(3);
  },
);

test('four levels: open areas take their measured heights at every depth with no AG Grid error', async () => {
  routeDeep();
  setObservedHeight(180);
  const gridErrors = jest.spyOn(console, 'error');
  const gridWarnings = jest.spyOn(console, 'warn');
  const { container } = render(<TreeTableChart {...fourLevelProps()} />);
  await userEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  await userEvent.click(toggleOf('P'));
  await screen.findByText('2 Interactions');
  await userEvent.click(toggleOf('i1 voice'));
  await screen.findByText('2 Segments');
  await waitFor(() => {
    const rows = [
      ...container.querySelectorAll<HTMLElement>('.ag-full-width-row'),
    ];
    expect(rows.map(depthOf).sort()).toEqual([1, 2, 3]);
    rows.forEach(row => expect(row.style.height).toBe('180px'));
  });
  const messages = [...gridErrors.mock.calls, ...gridWarnings.mock.calls]
    .flat()
    .join(' ');
  expect(messages).not.toContain('AG Grid: error');
  expect(messages).not.toContain('#200');
  gridErrors.mockRestore();
  gridWarnings.mockRestore();
});

test.each([
  ['a refresh', true],
  ['a filter change', false],
])(
  'four levels: %s keeps the open rows three deep and reloads them level by level with the same force; old rows stay until each answer',
  async (_name, force) => {
    routeDeep();
    const value = fourLevelProps();
    const { rerender } = render(<Harness value={value} onMask={jest.fn()} />);
    await userEvent.click(toggleOf('Q1'));
    await screen.findByText('2 Agents');
    await userEvent.click(toggleOf('P'));
    await screen.findByText('2 Interactions');
    await userEvent.click(toggleOf('i1 voice'));
    await screen.findByText('2 Segments');
    expect(deepBatchBodies()).toHaveLength(3);
    const release = holdDeep();
    rerender(
      <Harness
        value={{
          ...value,
          data: [...queueRows],
          rawFormData: force
            ? value.rawFormData
            : {
                ...value.rawFormData,
                extra_form_data: { time_range: 'Last week' },
              },
        }}
        onMask={jest.fn()}
      />,
    );
    await waitFor(() => expect(deepBatchBodies()).toHaveLength(4));
    expect(screen.getByText('2 Segments')).toBeInTheDocument();
    expect(screen.getByText('i1 no 0')).toBeInTheDocument();
    await release();
    await waitFor(() => expect(deepBatchBodies()).toHaveLength(6));
    await tick();
    expect(
      deepBatchBodies()
        .slice(3)
        .map(body => [deepLevelOf(body), body.force]),
    ).toEqual([
      [1, force],
      [2, force],
      [3, force],
    ]);
    expect(
      deepBatchBodies()[5].queries[0].filters.filter(
        filter => filter.op === 'IN',
      ),
    ).toEqual([
      { col: 'queue', op: 'IN', val: ['Q1'] },
      { col: 'agent', op: 'IN', val: ['P'] },
      { col: 'interaction_id', op: 'IN', val: ['i1'] },
    ]);
    expect(screen.getByText('2 Segments')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^Collapse (?!all$)/ }),
    ).toHaveLength(3);
  },
);

/** Area roots: the renderer's element, whose first child is the status marker. */
const areaRoots = (container: HTMLElement, depth: number) =>
  [...container.querySelectorAll('.tree-table-area-status')]
    .map(status => status.parentElement as HTMLElement)
    .filter(root => depthOf(root) === depth);

/** The placeholder of an area without its contents: a plain element with an inline height only. */
const placeholderOf = (root: HTMLElement) => {
  const last = root.lastElementChild as HTMLElement;
  return last.classList.contains('tree-table-area-status') ||
    last.childElementCount > 0 ||
    last.classList.length > 0
    ? null
    : last;
};

test('an open area far from the chart viewport keeps only its height and mounts its details and nested grid when scrolled into view or entered by keyboard', async () => {
  let farDepth = 3;
  const rect = jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function rectOf(this: HTMLElement) {
      const isArea = this.firstElementChild?.classList.contains(
        'tree-table-area-status',
      );
      const top = isArea && depthOf(this) >= farDepth ? 5000 : 0;
      return { top, bottom: top + 400, height: 400 } as DOMRect;
    });
  const SyncObserver = global.ResizeObserver;
  const observed = new Map<Element, ResizeObserverCallback>();
  global.ResizeObserver = class {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(element: Element) {
      observed.set(element, this.callback);
    }

    unobserve() {}

    disconnect() {
      [...observed].forEach(([element, callback]) => {
        if (callback === this.callback) observed.delete(element);
      });
    }
  } as unknown as typeof ResizeObserver;
  /** The browser measures every observed element at `height`. */
  const measureAll = (height: number) =>
    act(() =>
      [...observed].forEach(([target, callback]) =>
        callback(
          [
            {
              contentRect: { height },
              target,
            } as unknown as ResizeObserverEntry,
          ],
          {} as ResizeObserver,
        ),
      ),
    );
  try {
    routeDeep();
    const { container } = render(deepKeyboardChart({ levels: S4_LEVELS }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Expand all to level' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Expand to Segments' }),
    );
    await waitFor(() => expect(deepBatchBodies()).toHaveLength(3));
    await screen.findByText('i2 voice');
    await tick();
    expect(deepBatchBodies().map(deepLevelOf)).toEqual([1, 2, 3]);
    ['i1 voice', 'i2 voice', 'i3 voice', 'i4 voice'].forEach(text =>
      expect(toggleOf(text)).toHaveAttribute('aria-expanded', 'true'),
    );
    const far = areaRoots(container, 3);
    expect(far).toHaveLength(4);
    far.forEach(root => {
      const placeholder = placeholderOf(root);
      expect(placeholder).not.toBeNull();
      expect(parseInt(placeholder!.style.height, 10)).toBeGreaterThan(0);
    });
    expect(
      screen.queryByRole('group', {
        name: 'Interaction details',
        hidden: true,
      }),
    ).toBeNull();
    expect(gridsAtDepth(container, 3)).toHaveLength(0);

    const scroll = async () => {
      fireEvent.scroll(container.querySelector('[data-themed-ag-grid]')!);
      // Viewport updates run in an animation frame after the scroll event.
      await tick();
    };
    farDepth = Infinity;
    await scroll();
    expect(
      screen.getAllByRole('group', {
        name: 'Interaction details',
        hidden: true,
      }),
    ).toHaveLength(4);
    expect(
      screen.getAllByRole('group', { name: 'Segment details', hidden: true }),
    ).toHaveLength(5);
    expect(gridsAtDepth(container, 3)).toHaveLength(3);
    await measureAll(77);
    await tick();

    farDepth = 3;
    await scroll();
    expect(
      screen.queryByRole('group', {
        name: 'Interaction details',
        hidden: true,
      }),
    ).toBeNull();
    areaRoots(container, 3).forEach(root =>
      expect(placeholderOf(root)).toHaveStyle({ height: '77px' }),
    );
    expect(deepBatchBodies()).toHaveLength(3);

    screen
      .getByText('i1 voice')
      .closest<HTMLElement>('[role="gridcell"]')!
      .focus();
    await pressTab();
    expect(describeDeep()).toBe('3 columnheader ');
    expect(
      screen.getAllByRole('group', {
        name: 'Interaction details',
        hidden: true,
      }),
    ).toHaveLength(1);
    expect(gridsAtDepth(container, 3)).toHaveLength(1);
    await scroll();
    expect(gridsAtDepth(container, 3)).toHaveLength(1);
    expect(describeDeep()).toBe('3 columnheader ');
  } finally {
    global.ResizeObserver = SyncObserver;
    rect.mockRestore();
  }
});
