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
  ChildBody,
  Harness,
  data,
  focusedStop,
  inOf,
  level,
  openFirst,
  pageSizeSelect,
  parentCell,
  pressTab,
  props,
  routeSteps,
  setObservedHeight,
  stepLevel,
  setStepsFail,
  holdSteps,
  waitForSteps,
  stepsShown2,
  tick,
  trackLoadMoreScroll,
  twoLevels,
  userEvent,
} from '../../test/treeTableChartTestUtils';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
} from '@superset-ui/core/spec';
import { GenericDataType } from '@apache-superset/core/common';
import fetchMock from 'fetch-mock';
import TreeTableChart from './TreeTableChart';
import * as fetchModule from './fetchTreeTableData';
import { TreeTableTransformedProps } from './types';

const lastRowData = [
  { session_id: 'S1', channel: 'Voice' },
  { session_id: 'S2', channel: 'Chat' },
];

const childRequests = (): ChildBody[] =>
  fetchMock.callHistory
    .calls(CHART_DATA_ENDPOINT)
    .map(call => JSON.parse(call.options.body as string) as ChildBody);

const childBatchBodies = () =>
  childRequests().filter(
    body =>
      body.queries.length > 1 ||
      body.queries[0].metrics?.length ||
      body.queries[0].row_offset,
  );

const childRowBodies = () =>
  childRequests().filter(body => !body.queries[0].metrics?.length);

function routeChildren(status = 200) {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    async ({ options }) => {
      const pending = waitForSteps();
      if (pending) await pending;
      if (status !== 200) return { status, body: { message: 'failed' } };
      const body = JSON.parse(options.body as string) as ChildBody;
      const ids: string[] = inOf(body)!;
      const answers = [
        {
          data: ids
            .filter(id => id === 'S1')
            .map(id => ({
              step_id: `${id}-a`,
              session_id: id,
              item_desc: 'Greeting',
              result: 'ok',
            })),
          colnames: ['step_id', 'session_id', 'item_desc', 'result'],
          coltypes: [1, 1, 1, 1],
        },
        {
          data: ids.includes('S1')
            ? [{ session_id: 'S1', 'COUNT_DISTINCT(step_id)': 1 }]
            : [],
          colnames: ['session_id', 'COUNT_DISTINCT(step_id)'],
          coltypes: [1, 0],
        },
      ];
      return {
        result: body.queries.map(query =>
          query.metrics?.length ? answers[1] : answers[0],
        ),
      };
    },
    { name: CHART_DATA_ENDPOINT },
  );
}

const parentButton = (container: HTMLElement, rowIndex: number) =>
  container
    .querySelector('.ag-grid-scrolling-container')!
    .querySelector<HTMLElement>(
      `:scope > [row-id="row-${rowIndex}"] [col-id="tree_table_expand"] button`,
    )!;

test('opening a parent shows a loading area, then its detail and children from one batch', async () => {
  routeChildren();
  const gridErrors = jest.spyOn(console, 'error');
  const { container } = render(<TreeTableChart {...twoLevels()} />);
  const [first] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  const release = holdSteps();
  await userEvent.click(first);
  await waitFor(() =>
    expect(
      container.querySelector('.ag-full-width-row .loading'),
    ).toBeInTheDocument(),
  );
  await release();
  expect(await screen.findAllByText('Greeting')).toHaveLength(2);
  expect(screen.getAllByText('1 Step')).toHaveLength(2);
  expect(
    screen.getAllByRole('group', { name: 'Session details', hidden: true }),
  ).toHaveLength(2);
  expect(childBatchBodies()).toHaveLength(1);
  expect(inOf(childBatchBodies()[0])).toEqual(['S1', 'S2']);
  expect(childBatchBodies()[0].force).toBe(false);
  await userEvent.click(parentButton(container, 1));
  expect(await screen.findByText('No Steps')).toBeInTheDocument();
  await tick();
  expect(childBatchBodies()).toHaveLength(1);
  expect(gridErrors.mock.calls.flat().join(' ')).not.toContain(
    'AG Grid: error',
  );
  gridErrors.mockRestore();
});

test('an open area takes its measured height and the next row starts under it', async () => {
  routeChildren();
  setObservedHeight(260);
  const gridErrors = jest.spyOn(console, 'error');
  const { container } = render(
    <TreeTableChart {...twoLevels({ levels: [level] })} />,
  );
  const [first] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  await userEvent.click(first);
  await waitFor(() =>
    expect(
      container.querySelector<HTMLElement>('.ag-full-width-row')?.style.height,
    ).toBe('260px'),
  );
  const top = (rowIndex: number) =>
    parseInt(
      container
        .querySelector<HTMLElement>(
          `.ag-grid-scrolling-container > [row-index="${rowIndex}"]`,
        )!
        .style.transform.replace(/[^0-9]/g, '') || '0',
      10,
    );
  const fullWidth = container.querySelector<HTMLElement>('.ag-full-width-row')!;
  const markerTop = parseInt(
    fullWidth.style.transform.replace(/[^0-9]/g, '') || '0',
    10,
  );
  expect(top(2)).toBe(markerTop + 260);
  expect(childBatchBodies()).toHaveLength(0);
  expect(gridErrors.mock.calls.flat().join(' ')).not.toContain(
    'AG Grid: error',
  );
  gridErrors.mockRestore();
});

test('a failed batch shows Retry on each open row and Retry reloads one parent', async () => {
  routeChildren(500);
  const { container } = render(<TreeTableChart {...twoLevels()} />);
  const [first] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  await userEvent.click(first);
  expect(await screen.findAllByText("Couldn't load Steps —")).toHaveLength(2);
  fetchMock.removeRoutes({ names: [CHART_DATA_ENDPOINT] });
  routeChildren();
  await userEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
  expect(await screen.findAllByText('Greeting')).toHaveLength(2);
  await userEvent.click(parentButton(container, 1));
  expect(await screen.findByText('No Steps')).toBeInTheDocument();
  expect(childBatchBodies().map(inOf)).toEqual([['S1', 'S2'], ['S1'], ['S2']]);
});

test('the collapse handlers close parent and child rows and the next open sends a new batch', async () => {
  routeChildren();
  const onMask = jest.fn();
  const { container } = render(<Harness value={twoLevels()} onMask={onMask} />);
  const [first] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  await userEvent.click(first);
  await screen.findAllByText('Greeting');
  const childExpand = container.querySelector<HTMLElement>(
    '.ag-full-width-row [col-id="tree_table_expand"] button',
  )!;
  await userEvent.click(childExpand);
  expect(
    await screen.findAllByRole('group', { name: 'Step details', hidden: true }),
  ).toHaveLength(2);
  fireEvent.mouseDown(pageSizeSelect());
  await userEvent.click(await screen.findByTitle('100'));
  await waitFor(() =>
    expect(onMask).toHaveBeenCalledWith({
      ownState: { pageSize: 100, currentPage: 0 },
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByRole('group', { name: 'Step details', hidden: true }),
  ).not.toBeInTheDocument();
  await userEvent.click(parentButton(container, 0));
  await screen.findAllByText('Greeting');
  expect(
    screen.queryByRole('group', { name: 'Step details', hidden: true }),
  ).not.toBeInTheDocument();
  expect(childBatchBodies().map(inOf)).toEqual([
    ['S1', 'S2'],
    ['S1', 'S2'],
  ]);
});

test('clicks in the open area never cross-filter; parent cells still do', async () => {
  routeChildren();
  const onMask = jest.fn();
  const { container } = render(
    <Harness value={twoLevels({ emitCrossFilters: true })} onMask={onMask} />,
  );
  const [first] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  await userEvent.click(first);
  const [greeting] = await screen.findAllByText('Greeting');
  await userEvent.click(greeting);
  await userEvent.click(
    screen.getAllByRole('group', { name: 'Session details', hidden: true })[0],
  );
  await userEvent.click(screen.getAllByText('item_desc')[0]);
  await userEvent.click(screen.getAllByText('1 Step')[0]);
  await userEvent.click(
    container.querySelector<HTMLElement>(
      '.ag-full-width-row [col-id="tree_table_expand"] button',
    )!,
  );
  await screen.findAllByRole('group', { name: 'Step details', hidden: true });
  await userEvent.click(
    screen.getAllByRole('group', { name: 'Step details', hidden: true })[0],
  );
  await tick();
  expect(onMask).not.toHaveBeenCalled();
  await userEvent.click(
    container.querySelector(
      '.ag-grid-scrolling-container > [row-index="0"] [col-id="channel"]',
    )!,
  );
  await waitFor(() =>
    expect(onMask).toHaveBeenCalledWith(
      expect.objectContaining({
        extraFormData: {
          filters: [{ col: 'channel', op: 'IN', val: ['Voice'] }],
        },
      }),
    ),
  );
});

test('new data keeps open rows open and sends one forced batch without looping', async () => {
  routeChildren();
  const value = twoLevels();
  const onMask = jest.fn();
  const { rerender } = render(<Harness value={value} onMask={onMask} />);
  const [first] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  await userEvent.click(first);
  await screen.findAllByText('Greeting');
  rerender(<Harness value={{ ...value, data: [...data] }} onMask={onMask} />);
  await screen.findAllByText('Greeting');
  await tick();
  await tick();
  expect(
    screen.getAllByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toHaveLength(2);
  expect(childBatchBodies().map(body => body.force)).toEqual([false, true]);
  expect(onMask).not.toHaveBeenCalled();
});

test('Expand all is available when refreshed data adds a collapsed parent', async () => {
  routeChildren();
  const value = twoLevels({ data: [lastRowData[0]] });
  const onMask = jest.fn();
  const { rerender } = render(<Harness value={value} onMask={onMask} />);
  await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
  await screen.findAllByText('Greeting');
  expect(screen.getByRole('button', { name: 'Collapse all' })).toBeVisible();

  rerender(<Harness value={{ ...value, data: lastRowData }} onMask={onMask} />);
  const expandAll = await screen.findByRole('button', { name: 'Expand all' });
  await userEvent.click(expandAll);
  expect(screen.getByRole('button', { name: 'Collapse S1' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Collapse S2' })).toBeVisible();
});

const describeFocus = () => {
  const element = focusedStop();
  if (!element || element === document.body) return 'BODY';
  const role = element.getAttribute('role') ?? element.tagName.toLowerCase();
  const name =
    element.getAttribute('aria-label') ??
    (element.matches('.ag-full-width-row') ? 'area' : element.textContent);
  const grid = element.closest('.ag-full-width-row') ? 'child' : 'parent';
  return `${grid} ${role} ${name}`;
};

test('each open area and each step detail renders once, in the centre section, from one request (Expand all to Steps)', async () => {
  routeSteps(2);
  const { container } = render(
    <TreeTableChart
      {...twoLevels({
        data: lastRowData,
        levels: [level, { ...stepLevel, children_shown: 2 }],
      })}
    />,
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'Expand all' }),
  );
  await waitFor(() =>
    expect(
      screen.getAllByRole('group', { name: 'Step details', hidden: true }),
    ).toHaveLength(2),
  );
  await tick();
  const areas = container.querySelectorAll('.tree-table-area-status');
  expect(areas).toHaveLength(4);
  expect(
    [...areas].filter(area =>
      area.closest('.ag-grid-pinned-left-cells, .ag-grid-pinned-right-cells'),
    ),
  ).toHaveLength(0);
  expect(
    screen.getAllByRole('group', { name: 'Session details', hidden: true }),
  ).toHaveLength(2);
  expect(screen.getAllByText('Step 0')).toHaveLength(1);
  expect(screen.getAllByText('No Steps')).toHaveLength(1);
  expect(container.querySelectorAll('[data-themed-ag-grid]')).toHaveLength(2);
  expect(childBatchBodies()).toHaveLength(1);
});

const keyboardChart = (extra: Partial<TreeTableTransformedProps> = {}) => (
  <>
    <button type="button">Before</button>
    <TreeTableChart
      {...twoLevels({ levels: [level, stepsShown2], ...extra })}
    />
    <button type="button">After</button>
  </>
);

async function walk(steps: number, shift = false) {
  const log: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    await pressTab(shift);
    log.push(describeFocus());
  }
  return log;
}

const PARENT_ROW_S1 = [
  'parent gridcell ',
  'parent gridcell S1',
  'parent gridcell Voice',
];

const PARENT_ROW_S2 = [
  'parent gridcell ',
  'parent gridcell S2',
  'parent gridcell Chat',
];

const STEPS_AREA = [
  'child columnheader     item_desc            ',
  'child gridcell Step 0',
  'child gridcell Step 1',
  'child button Load more',
];

test('keyboard: Tab goes through the top bar, the parents, into an open area (header, cells, Load more) and out; Shift+Tab goes back the same way', async () => {
  routeSteps();
  render(keyboardChart());
  await openFirst();
  await screen.findAllByText('Step 0');
  await tick();
  screen.getByRole('button', { name: 'Before' }).focus();
  const forward = await walk(22);
  expect(forward).toEqual([
    'parent button Expand all',
    'parent columnheader                 ',
    'parent columnheader     Session Id   1         ',
    'parent columnheader     Channel            ',
    ...PARENT_ROW_S1,
    ...STEPS_AREA,
    ...PARENT_ROW_S2,
    ...PARENT_ROW_S1,
    ...STEPS_AREA,
    'parent gridcell ',
  ]);
  const back = await walk(22, true);
  expect(back).toEqual(
    [...forward].reverse().slice(1).concat('parent button Before'),
  );
  expect([...forward, ...back]).not.toContain('BODY');
});

test('Tab from an already mounted area reached by ArrowDown enters its named child header', async () => {
  routeSteps(2);
  const { container } = render(keyboardChart());
  await openFirst();
  await screen.findAllByText('Step 0');
  const cell = parentCell(container, 'row-0', 'session_id');
  act(() => cell.focus());
  fireEvent.keyDown(cell, { key: 'ArrowDown', code: 'ArrowDown' });
  await waitFor(() =>
    expect(document.activeElement).toHaveClass('ag-full-width-row'),
  );
  await pressTab();
  await waitFor(() => {
    expect(document.activeElement).toHaveAttribute('role', 'columnheader');
    expect(document.activeElement).toHaveAccessibleName('item_desc');
  });
});

test('keyboard: an error area routes through its Retry; empty and loading areas pass on to the next parent row', async () => {
  routeSteps();
  setStepsFail(true);
  const { container } = render(keyboardChart());
  await openFirst();
  await screen.findAllByText("Couldn't load Steps —");
  parentCell(container, 'row-0', 'channel').focus();
  expect(await walk(2)).toEqual(['child button Retry', 'parent gridcell ']);
  expect(await walk(2, true)).toEqual([
    'child button Retry',
    'parent gridcell Voice',
  ]);
  setStepsFail(false);
  await userEvent.click(
    parentCell(container, 'row-1', 'tree_table_expand').querySelector(
      'button',
    )!,
  );
  await screen.findByText('No Steps');
  parentCell(container, 'row-1', 'channel').focus();
  expect(await walk(1)).toEqual(['parent gridcell ']);
  expect(focusedStop()).toBe(
    parentCell(container, 'row-2', 'tree_table_expand'),
  );
  expect(await walk(1, true)).toEqual(['parent gridcell Chat']);
  const release = holdSteps();
  await userEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
  await userEvent.click(
    parentCell(container, 'row-0', 'tree_table_expand').querySelector(
      'button',
    )!,
  );
  await userEvent.click(
    parentCell(container, 'row-0', 'tree_table_expand').querySelector(
      'button',
    )!,
  );
  await waitFor(() =>
    expect(
      container.querySelector('.ag-full-width-row .loading'),
    ).toBeInTheDocument(),
  );
  parentCell(container, 'row-0', 'channel').focus();
  expect(await walk(1)).toEqual(['parent gridcell ']);
  expect(focusedStop()).toBe(
    parentCell(container, 'row-1', 'tree_table_expand'),
  );
  await release();
  await screen.findAllByText('Step 0');
});

test('keyboard: Retry keeps its node and focus while pending, then focus goes to that row +/- cell', async () => {
  routeSteps();
  setStepsFail(true);
  const { container } = render(keyboardChart());
  await openFirst();
  await screen.findAllByText("Couldn't load Steps —");
  setStepsFail(false);
  const [retry] = screen.getAllByRole('button', { name: 'Retry' });
  const status = container.querySelector<HTMLElement>(
    '.ag-full-width-row .tree-table-area-status',
  )!;
  expect(status.dataset).toMatchObject({ state: 'error', origin: 'user' });
  retry.focus();
  const release = holdSteps();
  await userEvent.type(retry, '{enter}', { skipClick: true });
  await tick();
  const [pending] = screen.getAllByRole('button', { name: /Retry/ });
  expect(pending.isSameNode(retry)).toBe(true);
  expect(pending).toHaveClass('ant-btn-loading');
  expect(document.activeElement).toBe(retry);
  expect(status.dataset).toMatchObject({ state: 'loading', action: 'retry' });
  await release();
  await screen.findAllByText('Step 0');
  expect(status.isConnected).toBe(true);
  expect(status.dataset).toMatchObject({
    state: 'loaded',
    action: 'retry',
    origin: 'user',
    loaded: '2',
    total: '3',
  });
  await waitFor(() =>
    expect(focusedStop()).toBe(
      parentCell(container, 'row-0', 'tree_table_expand'),
    ),
  );
});

test('keyboard: level 2 final Load more focuses the appended row without scrolling', async () => {
  routeSteps(5);
  const { container } = render(keyboardChart());
  await openFirst();
  await screen.findAllByText('2 of 5 Steps');
  const [more] = screen.getAllByRole('button', { name: 'Load more' });
  more.focus();
  const release = holdSteps();
  await userEvent.type(more, '{enter}', { skipClick: true });
  await tick();
  expect(
    screen.getAllByRole('button', { name: /Load more/ })[0].isSameNode(more),
  ).toBe(true);
  expect(more).toHaveClass('ant-btn-loading');
  expect(document.activeElement).toBe(more);
  const checkScroll = trackLoadMoreScroll(container);
  await release();
  expect(await screen.findAllByText('4 of 5 Steps')).toHaveLength(2);
  expect(more.isConnected).toBe(true);
  expect(more).toHaveFocus();
  checkScroll();
  const checkFinalScroll = trackLoadMoreScroll(container);
  await userEvent.type(more, '{enter}', { skipClick: true });
  expect(await screen.findAllByText('5 Steps')).not.toHaveLength(0);
  expect(screen.queryByText('4 of 5 Steps')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  await tick();
  checkFinalScroll();
  await waitFor(() =>
    expect(document.activeElement?.closest('[row-id]')).toHaveAttribute(
      'row-id',
      'row-4',
    ),
  );
  expect(document.activeElement).toHaveClass('ag-cell-focus');
  expect(
    childBatchBodies().map(body => [
      body.queries.length,
      (body.queries[0] as { row_offset?: number }).row_offset,
    ]),
  ).toEqual([
    [1, 0],
    [1, 2],
    [1, 4],
  ]);
  expect(screen.getAllByText('Step 4').length).toBeGreaterThan(0);
});

test('keyboard: a child sort keeps focus on its header and the old rows until the answer, in every open Steps table', async () => {
  routeSteps(3);
  const { container } = render(
    keyboardChart({
      levels: [
        level,
        {
          ...stepsShown2,
          children_shown: 3,
          columns: ['item_desc', 'step_id'],
        },
      ],
    }),
  );
  await openFirst();
  await screen.findAllByText('3 Steps');
  const header = container.querySelector<HTMLElement>(
    '.ag-full-width-row [role="columnheader"][col-id="item_desc"]',
  )!;
  header.focus();
  const release = holdSteps();
  fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' });
  await tick();
  expect(container.querySelector('.ag-full-width-row .loading')).toBeNull();
  expect(screen.getAllByText('Step 0')).toHaveLength(2);
  expect(document.activeElement).toBe(header);
  await release();
  await tick();
  const [, sorted] = childRowBodies();
  expect(childRowBodies()).toHaveLength(2);
  expect(sorted.queries).toHaveLength(1);
  expect((sorted.queries[0] as { orderby?: unknown }).orderby).toEqual([
    ['session_id', true],
    ['item_desc', true],
    ['step_id', true],
  ]);
  expect(header.isConnected).toBe(true);
  expect(document.activeElement).toBe(header);
  const headers = container.querySelectorAll(
    '.ag-full-width-row [role="columnheader"][col-id="item_desc"]',
  );
  expect(headers).toHaveLength(2);
  headers.forEach(item =>
    expect(item).toHaveAttribute('aria-sort', 'ascending'),
  );
  fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' });
  await waitFor(() => expect(childRowBodies()).toHaveLength(3));
  await waitFor(() =>
    expect(
      Array.from(
        container.querySelectorAll(
          '.ag-full-width-row .ag-grid-scrolling-container > [row-index="0"] [col-id="item_desc"]',
        ),
      ).map(cell => cell.textContent),
    ).toEqual(['Step 2', 'Step 2']),
  );
  fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' });
  await waitFor(() => expect(childRowBodies()).toHaveLength(4));
  expect(
    (childRowBodies()[3].queries[0] as { orderby?: unknown }).orderby,
  ).toEqual([
    ['session_id', true],
    ['step_id', true],
  ]);
  await waitFor(() => expect(header).toHaveAttribute('aria-sort', 'none'));
  const defaultHeaders = container.querySelectorAll(
    '.ag-full-width-row [role="columnheader"][col-id="step_id"]',
  );
  expect(defaultHeaders).toHaveLength(2);
  defaultHeaders.forEach(item =>
    expect(item).toHaveAttribute('aria-sort', 'ascending'),
  );
  expect(
    screen.getAllByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toHaveLength(2);
});

test.each([true, false, undefined])(
  'child default column cycle preserves effective server order (ascending: %s)',
  async ascending => {
    routeSteps(3);
    const { container } = render(
      keyboardChart({
        levels: [
          level,
          {
            ...stepsShown2,
            children_shown: 3,
            columns: ['item_desc', 'step_id'],
            sort: ascending === undefined ? undefined : ['step_id', ascending],
          },
        ],
      }),
    );
    await openFirst();
    await screen.findAllByText('3 Steps');
    const header = container.querySelector<HTMLElement>(
      '.ag-full-width-row [role="columnheader"][col-id="step_id"]',
    )!;
    const directions =
      ascending === undefined
        ? [true, false, true]
        : [!ascending, ascending, !ascending];
    expect(header).toHaveAttribute(
      'aria-sort',
      ascending === false ? 'descending' : 'ascending',
    );
    if (ascending !== undefined) {
      await userEvent.click(
        container.querySelector(
          '.ag-full-width-row [col-id="item_desc"] .ag-header-cell-label',
        )!,
      );
      await waitFor(() => expect(childRowBodies()).toHaveLength(2));
    }
    const requestsBeforeCycle = childRowBodies().length;
    for (const [index, direction] of directions.entries()) {
      await userEvent.click(header.querySelector('.ag-header-cell-label')!);
      const requestIndex = requestsBeforeCycle + index;
      await waitFor(() =>
        expect(childRowBodies()).toHaveLength(requestIndex + 1),
      );
      expect(childRowBodies()[requestIndex].queries[0]).toMatchObject({
        orderby: [
          ['session_id', true],
          ['step_id', direction],
        ],
      });
      expect(header).toHaveAttribute(
        'aria-sort',
        direction ? 'ascending' : 'descending',
      );
      expect(
        header.querySelector('.ag-sort-indicator-icon:not(.ag-hidden)'),
      ).toBeInTheDocument();
    }
  },
);

test('top bar: two-level menu opens sessions only, then leaf details with one request; Load more inherits expansion; closing a leaf changes the toggle back to Expand all', async () => {
  routeSteps(5);
  const onMask = jest.fn();
  const detailSteps = { ...stepLevel, children_shown: 2 };
  const { container } = render(
    <Harness
      value={twoLevels({ levels: [level, detailSteps] })}
      onMask={onMask}
    />,
  );
  const menu = screen.getByRole('button', { name: 'Expand all to level' });
  await userEvent.click(menu);
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Expand to Session' }),
  );
  await screen.findAllByText('2 of 5 Steps');
  const parentToggles = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        '[col-id="tree_table_expand"] button[aria-expanded]',
      ),
    ).filter(button => !button.closest('.ag-full-width-row'));
  expect(parentToggles().length).toBeGreaterThan(1);
  parentToggles().forEach(button =>
    expect(button).toHaveAttribute('aria-expanded', 'true'),
  );
  expect(childBatchBodies()).toHaveLength(1);
  expect(inOf(childBatchBodies()[0])).toEqual(['S1', 'S2']);
  expect(
    screen.queryByRole('group', { name: 'Step details', hidden: true }),
  ).toBeNull();
  await userEvent.click(menu);
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Expand to Steps' }),
  );

  const firstArea = () =>
    container.querySelector<HTMLElement>('.ag-full-width-row')!;
  const childToggles = () =>
    Array.from(
      firstArea().querySelectorAll<HTMLElement>(
        '[col-id="tree_table_expand"] button',
      ),
    );
  await waitFor(() =>
    expect(
      within(firstArea()).getAllByRole('group', {
        name: 'Step details',
        hidden: true,
      }),
    ).toHaveLength(2),
  );
  expect(childBatchBodies()).toHaveLength(1);
  await userEvent.click(
    within(firstArea()).getByRole('button', { name: 'Load more' }),
  );
  await screen.findAllByText('4 of 5 Steps');
  await tick();
  expect(childToggles()).toHaveLength(4);
  childToggles().forEach(button =>
    expect(button).toHaveAttribute('aria-expanded', 'true'),
  );
  await userEvent.click(childToggles()[1]);
  await waitFor(() =>
    expect(
      childToggles().map(button => button.getAttribute('aria-expanded')),
    ).toEqual(['true', 'false', 'true', 'true']),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
  const collapse = await screen.findByRole('button', { name: 'Collapse all' });
  collapse.focus();
  await userEvent.type(collapse, '{enter}', { skipClick: true });
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
    ).toBeNull(),
  );
  expect(document.activeElement).toBe(collapse);
  expect(collapse).toHaveTextContent('Expand all');
  expect(childBatchBodies()).toHaveLength(2);
  await userEvent.click(
    parentCell(container, 'row-0', 'tree_table_expand').querySelector(
      'button',
    )!,
  );
  await screen.findAllByText('4 of 5 Steps');
  expect(childBatchBodies()).toHaveLength(2);
  expect(onMask).not.toHaveBeenCalled();
});

test.each(['main button', 'level menu'])(
  '%s keeps the last collapse intent after delayed answers',
  async control => {
    const answers: (() => void)[] = [];
    const response = [
      {
        rowcount: 1,
        sql_rowcount: 1,
        data: [
          {
            session_id: 'S1',
            step_id: 'a',
            item_desc: 'Greeting',
            result: 'ok',
          },
        ],
        colnames: ['session_id', 'step_id', 'item_desc', 'result'],
        coltypes: [
          GenericDataType.String,
          GenericDataType.String,
          GenericDataType.String,
          GenericDataType.String,
        ],
      },
      {
        data: [
          { session_id: 'S1', 'COUNT_DISTINCT(step_id)': 1 },
          { session_id: 'S2', 'COUNT_DISTINCT(step_id)': 0 },
        ],
        colnames: [],
        coltypes: [],
        rowcount: 2,
        sql_rowcount: 2,
      },
    ];
    const spy = jest
      .spyOn(fetchModule, 'default')
      .mockImplementation(params => {
        const { queries } = params.buildQuery(params.formData);
        const result = queries.map(query =>
          query.metrics?.length ? response[1] : response[0],
        );
        if (!queries[0].metrics?.length && queries.length === 1)
          return Promise.resolve(result);
        return new Promise(resolve => answers.push(() => resolve(result)));
      });
    try {
      render(<TreeTableChart {...twoLevels()} />);
      const button = screen.getByRole('button', { name: 'Expand all' });
      if (control === 'main button') {
        for (let click = 0; click < 6; click += 1) {
          fireEvent.click(button);
          expect(button).toHaveTextContent(
            click % 2 === 0 ? 'Collapse all' : 'Expand all',
          );
        }
        button.focus();
      } else {
        const arrow = screen.getByRole('button', {
          name: 'Expand all to level',
        });
        await userEvent.click(arrow);
        await userEvent.click(
          screen.getByRole('menuitem', { name: 'Expand to Steps' }),
        );
        expect(button).toHaveTextContent('Collapse all');
        await userEvent.click(button);
        expect(button).toHaveTextContent('Expand all');
        await waitFor(() => expect(button).toHaveFocus());
      }
      const focused = document.activeElement;
      await act(async () => answers.forEach(answer => answer()));
      await tick();
      expect(button).toHaveTextContent('Expand all');
      expect(
        screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
      ).toBeNull();
      expect(screen.queryByText('Greeting')).toBeNull();
      expect(document.activeElement).toBe(focused);
      const requests = spy.mock.calls.length;
      await userEvent.click(
        screen.getAllByRole('button', { name: /^Expand (?!all\b)/ })[0],
      );
      expect(await screen.findAllByText('Greeting')).not.toHaveLength(0);
      expect(spy).toHaveBeenCalledTimes(requests);
    } finally {
      spy.mockRestore();
    }
  },
);

test('top bar: the same toggle keeps focus and a page change closes rows', async () => {
  routeSteps(2);
  const onMask = jest.fn();
  render(
    <Harness
      value={twoLevels({ levels: [level, stepsShown2] })}
      onMask={onMask}
    />,
  );
  const button = screen.getByRole('button', { name: 'Expand all' });
  const release = holdSteps();
  await userEvent.click(button);
  expect(button).toHaveTextContent('Collapse all');
  await userEvent.keyboard('{enter}');
  await release();
  expect(
    screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toBeNull();
  await userEvent.click(button);
  await screen.findAllByText('2 Steps');
  expect(button).toHaveTextContent('Collapse all');
  await userEvent.keyboard('{enter}');
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
    ).toBeNull(),
  );
  expect(button).toHaveFocus();
  expect(button).toHaveTextContent('Expand all');
  await userEvent.click(button);
  await screen.findAllByText('2 Steps');
  fireEvent.mouseDown(pageSizeSelect());
  await userEvent.click(await screen.findByTitle('100'));
  await waitFor(() => expect(button).toHaveTextContent('Expand all'));
  expect(
    screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toBeNull();
});

test('top bar: shown only when a level can open; a 400 x 400 cell fills the remaining height; the grid height is the chart height minus the measured top bar and pager, re-computed when either wraps', async () => {
  const heights = { bar: 32, pager: 40 };
  const rect = jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function rectOf(this: HTMLElement) {
      let height = 0;
      if (this.querySelector(':scope > div > .ant-pagination'))
        height = heights.pager;
      else if (this.querySelector(':scope > .tree-table-toolbar'))
        height = heights.bar;
      return { top: 0, bottom: height, height } as DOMRect;
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

    unobserve(element: Element) {
      observed.delete(element);
    }

    disconnect() {
      [...observed].forEach(([element, callback]) => {
        if (callback === this.callback) observed.delete(element);
      });
    }
  } as unknown as typeof ResizeObserver;
  const resizeAll = () =>
    act(() =>
      [...observed].forEach(([target, callback]) =>
        callback(
          [{ target } as unknown as ResizeObserverEntry],
          {} as ResizeObserver,
        ),
      ),
    );
  try {
    const { container, rerender } = render(
      <TreeTableChart
        {...props({ width: 400, levels: [{ ...level, detail_fields: [] }] })}
      />,
    );
    await screen.findAllByText('Chat');
    expect(screen.queryByRole('button', { name: 'Expand all' })).toBeNull();
    const gridBox = () =>
      container.querySelector<HTMLElement>('[data-themed-ag-grid]')!
        .parentElement!;
    expect(gridBox().style.height).toBe('360px');
    rerender(<TreeTableChart {...props({ width: 400 })} />);
    expect(
      screen.getByRole('button', { name: 'Expand all' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(gridBox().style.height).toBe('328px'));
    heights.bar = 108;
    heights.pager = 74;
    await resizeAll();
    expect(gridBox().style.height).toBe('218px');
    rerender(
      <TreeTableChart
        {...props({
          levels: [{ ...level, detail_fields: [] }],
          width: 400,
        })}
      />,
    );
    expect(screen.queryByText('Expand all to:')).toBeNull();
    expect(screen.queryByText('Search by:')).toBeNull();
    await waitFor(() => expect(gridBox().style.height).toBe('326px'));
    heights.bar = 42;
    await resizeAll();
    expect(gridBox().style.height).toBe('326px');
  } finally {
    global.ResizeObserver = SyncObserver;
    rect.mockRestore();
  }
});

test('a refresh keeps the open rows and their old steps on screen until the new batch lands', async () => {
  routeSteps(2);
  const value = twoLevels({ levels: [level, stepsShown2] });
  const { container, rerender } = render(
    <Harness value={value} onMask={jest.fn()} />,
  );
  await openFirst();
  await screen.findAllByText('2 Steps');
  const release = holdSteps();
  rerender(
    <Harness value={{ ...value, data: [...data] }} onMask={jest.fn()} />,
  );
  await tick();
  expect(container.querySelector('.ag-full-width-row .loading')).toBeNull();
  expect(screen.getAllByText('Step 1')).toHaveLength(2);
  await release();
  await tick();
  expect(childBatchBodies().map(body => body.force)).toEqual([false, true]);
  expect(screen.getAllByText('Step 1')).toHaveLength(2);
});

test('keyboard: Tab moves along the child headers and cells when the child grid has its +/- column', async () => {
  routeSteps();
  const { container } = render(
    keyboardChart({
      levels: [level, { ...stepLevel, children_shown: 2 }],
    }),
  );
  await openFirst();
  await screen.findAllByText('Step 0');
  await tick();
  parentCell(container, 'row-0', 'channel').focus();
  const forward = await walk(7);
  expect(forward.map(step => step.replace(/\s+/g, ' ').trim())).toEqual([
    'child columnheader',
    'child columnheader item_desc',
    'child gridcell',
    'child gridcell Step 0',
    'child gridcell',
    'child gridcell Step 1',
    'child button Load more',
  ]);
  expect(await walk(7, true)).toEqual([
    ...forward.slice(0, 6).reverse(),
    'parent gridcell Voice',
  ]);
  await walk(3);
  parentCell(container, 'row-0', 'channel').focus();
  expect((await walk(3)).map(step => step.replace(/\s+/g, ' ').trim())).toEqual(
    ['child columnheader', 'child columnheader item_desc', 'child gridcell'],
  );
});

test('keyboard: forward Tab leaves an empty area in the last row and a last step detail (next stop or out of the grid); Shift+Tab goes back', async () => {
  routeSteps(5);
  const { container } = render(
    keyboardChart({
      data: lastRowData,
      levels: [level, { ...stepLevel, children_shown: 2 }],
    }),
  );
  await screen.findAllByRole('button', { name: /^Expand (?!all\b)/ });
  await userEvent.click(parentButton(container, 1));
  await screen.findByText('No Steps');
  await tick();
  parentCell(container, 'row-1', 'channel').focus();
  expect(await walk(3)).toEqual([
    'parent combobox Page Size:',
    'parent li 1',
    'parent li 2',
  ]);
  expect(await walk(3, true)).toEqual([
    'parent li 1',
    'parent combobox Page Size:',
    'parent gridcell Chat',
  ]);
  container.querySelector<HTMLElement>('.ag-full-width-row')!.focus();
  expect(await walk(2)).toEqual(['parent combobox Page Size:', 'parent li 1']);

  await userEvent.click(parentButton(container, 1));
  await userEvent.click(parentButton(container, 0));
  await screen.findByText('2 of 5 Steps');
  await userEvent.click(
    container.querySelectorAll<HTMLElement>(
      '.ag-full-width-row [col-id="tree_table_expand"] button',
    )[1],
  );
  await screen.findByRole('group', { name: 'Step details', hidden: true });
  await tick();
  const lastStep = () =>
    container.querySelector<HTMLElement>(
      '.ag-full-width-row .ag-grid-scrolling-container > [row-index="1"] [col-id="item_desc"]',
    )!;
  lastStep().focus();
  expect(await walk(4)).toEqual(['child button Load more', ...PARENT_ROW_S2]);
  expect(await walk(4, true)).toEqual([
    'parent gridcell S2',
    'parent gridcell ',
    'child button Load more',
    'child gridcell Step 1',
  ]);
  container
    .querySelector<HTMLElement>('.ag-full-width-row .ag-full-width-row')!
    .focus();
  expect(await walk(2)).toEqual(['child button Load more', 'parent gridcell ']);
});

test('a filter change keeps the open rows still on the page, drops the others for good and reloads children without force', async () => {
  routeSteps(2);
  const value = twoLevels({
    data: lastRowData,
    levels: [level, stepsShown2],
  });
  const { rerender } = render(<Harness value={value} onMask={jest.fn()} />);
  await openFirst();
  await screen.findByText('2 Steps');
  await userEvent.click(
    screen.getAllByRole('button', { name: /^Expand (?!all\b)/ })[0],
  );
  await screen.findByText('No Steps');
  const filtered = {
    ...value,
    data: [lastRowData[1]],
    rawFormData: {
      ...value.rawFormData,
      extra_form_data: {
        filters: [{ col: 'channel', op: '==' as const, val: 'Chat' }],
      },
    },
  };
  rerender(<Harness value={filtered} onMask={jest.fn()} />);
  await waitFor(() => expect(childBatchBodies()).toHaveLength(2));
  await tick();
  expect(screen.queryByText('Voice')).toBeNull();
  expect(
    screen.getByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toBeInTheDocument();
  expect(screen.getByText('No Steps')).toBeInTheDocument();
  rerender(
    <Harness value={{ ...value, data: [...lastRowData] }} onMask={jest.fn()} />,
  );
  await waitFor(() => expect(childBatchBodies()).toHaveLength(3));
  await tick();
  expect(screen.getByText('Voice')).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toHaveLength(1);
  expect(
    screen.getAllByRole('button', { name: /^Expand (?!all\b)/ }),
  ).toHaveLength(1);
  expect(screen.queryByText('2 Steps')).toBeNull();
  expect(childBatchBodies().map(body => [inOf(body), body.force])).toEqual([
    [['S1', 'S2'], false],
    [['S2'], false],
    [['S1', 'S2'], false],
  ]);
  expect(
    (childBatchBodies()[1] as unknown as { form_data: Record<string, unknown> })
      .form_data.extra_form_data,
  ).toEqual(filtered.rawFormData.extra_form_data);
});

test('Load more is in its loading state while a refresh batch is pending and starts nothing; the new first rows replace the old ones', async () => {
  routeSteps(5);
  const { rerender } = render(keyboardChart());
  await openFirst();
  await screen.findAllByText('2 of 5 Steps');
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Load more' })[0],
  );
  await screen.findAllByText('4 of 5 Steps');
  const release = holdSteps();
  rerender(keyboardChart({ data: [...data] }));
  await tick();
  const buttons = screen.getAllByRole('button', { name: /Load more/ });
  buttons.forEach(button => expect(button).toHaveClass('ant-btn-loading'));
  await userEvent.click(buttons[0]);
  await tick();
  expect(childBatchBodies()).toHaveLength(3);
  await release();
  expect(await screen.findAllByText('2 of 5 Steps')).toHaveLength(2);
  expect(screen.queryByText('Step 2')).toBeNull();
  expect(
    childBatchBodies().map(body => [
      body.force,
      (body.queries[0] as { row_offset?: number }).row_offset ?? 0,
    ]),
  ).toEqual([
    [false, 0],
    [false, 2],
    [true, 0],
  ]);
});

/** The status element of each rendered open area, in DOM order. */
const statuses = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>(
    '.ag-full-width-row .tree-table-status',
  ),
];

test('a user open speaks its area until the result lands; a dashboard filter change and a refresh keep the statuses off', async () => {
  routeSteps(2);
  const value = twoLevels({ data: lastRowData, levels: [level, stepsShown2] });
  const { container, rerender } = render(
    <Harness value={value} onMask={jest.fn()} />,
  );
  await screen.findAllByRole('button', { name: /^Expand (?!all\b)/ });
  const release = holdSteps();
  await userEvent.click(parentButton(container, 1));
  await waitFor(() =>
    expect(statuses(container)[0]).toHaveTextContent('Loading Steps'),
  );
  expect(statuses(container)[0]).toHaveAttribute('aria-live', 'polite');
  expect(
    container.querySelector('.ag-full-width-row .loading'),
  ).toHaveAttribute('aria-busy', 'true');
  await release();
  await waitFor(() =>
    expect(statuses(container)[0]).toHaveTextContent('No Steps'),
  );
  expect(statuses(container)[0]).toHaveAttribute('aria-live', 'polite');
  await waitFor(() =>
    expect(statuses(container)[0]).toHaveAttribute('aria-live', 'off'),
  );
  const filtered = {
    ...value,
    data: [lastRowData[1]],
    rawFormData: {
      ...value.rawFormData,
      extra_form_data: {
        filters: [{ col: 'channel', op: '==' as const, val: 'Chat' }],
      },
    },
  };
  const reload = holdSteps();
  rerender(<Harness value={filtered} onMask={jest.fn()} />);
  await waitFor(() => expect(childBatchBodies()).toHaveLength(2));
  expect(childBatchBodies()[1].force).toBe(false);
  await tick();
  expect(
    screen.getByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toBeInTheDocument();
  statuses(container).forEach(item =>
    expect(item).toHaveAttribute('aria-live', 'off'),
  );
  await reload();
  await waitFor(() =>
    expect(statuses(container)[0]).toHaveTextContent('No Steps'),
  );
  statuses(container).forEach(item =>
    expect(item).toHaveAttribute('aria-live', 'off'),
  );
  rerender(
    <Harness
      value={{ ...filtered, data: [...filtered.data] }}
      onMask={jest.fn()}
    />,
  );
  await waitFor(() => expect(childBatchBodies()).toHaveLength(3));
  expect(childBatchBodies()[2].force).toBe(true);
  await tick();
  statuses(container).forEach(item =>
    expect(item).toHaveAttribute('aria-live', 'off'),
  );
});

test('Expand all to Session leaves every status off; a row closed before its answer leaves no late text', async () => {
  routeSteps(2);
  const { container } = render(keyboardChart({ data: lastRowData }));
  await screen.findAllByRole('button', { name: /^Expand (?!all\b)/ });
  const release = holdSteps();
  await userEvent.click(parentButton(container, 0));
  await waitFor(() => expect(statuses(container)).toHaveLength(1));
  await userEvent.click(parentButton(container, 0));
  await waitFor(() => expect(statuses(container)).toHaveLength(0));
  await release();
  await tick();
  expect(statuses(container)).toHaveLength(0);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Expand all' }),
  );
  await screen.findByText('2 Steps');
  await waitFor(() => expect(statuses(container)).toHaveLength(2));
  statuses(container).forEach(item =>
    expect(item).toHaveAttribute('aria-live', 'off'),
  );
});

test.each([
  ['a refresh', true],
  ['a filter change', false],
])(
  '%s during a pending user open ends its live window; the replacement result never turns polite',
  async (_name, refresh) => {
    routeSteps(2);
    const value = twoLevels({
      data: lastRowData,
      levels: [level, stepsShown2],
    });
    const { container, rerender } = render(
      <Harness value={value} onMask={jest.fn()} />,
    );
    await screen.findAllByRole('button', { name: /^Expand (?!all\b)/ });
    const release = holdSteps();
    await userEvent.click(parentButton(container, 0));
    await waitFor(() =>
      expect(statuses(container)[0]).toHaveTextContent('Loading Steps'),
    );
    expect(statuses(container)[0]).toHaveAttribute('aria-live', 'polite');
    const next = refresh
      ? { ...value, data: [...value.data] }
      : {
          ...value,
          data: [lastRowData[0]],
          rawFormData: {
            ...value.rawFormData,
            extra_form_data: {
              filters: [{ col: 'channel', op: '==' as const, val: 'Voice' }],
            },
          },
        };
    rerender(<Harness value={next} onMask={jest.fn()} />);
    await waitFor(() => expect(childBatchBodies()).toHaveLength(2));
    expect(childBatchBodies()[1].force).toBe(refresh);
    const seen: string[] = [];
    const observer = new MutationObserver(() =>
      statuses(container).forEach(item =>
        seen.push(`${item.getAttribute('aria-live')} ${item.textContent}`),
      ),
    );
    observer.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-live'],
    });
    await tick();
    expect(statuses(container)[0]).toHaveAttribute('aria-live', 'off');
    await release();
    await waitFor(() =>
      expect(statuses(container)[0]).toHaveTextContent('2 Steps'),
    );
    await tick();
    observer.disconnect();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter(item => item.startsWith('polite'))).toEqual([]);
    expect(statuses(container)[0]).toHaveAttribute('aria-live', 'off');
  },
);

test('a Retry that fails again with the same error shows "Loading Steps" while pending, then the error lands polite, then off', async () => {
  routeSteps(2);
  setStepsFail(true);
  const value = twoLevels({ data: lastRowData, levels: [level, stepsShown2] });
  const { container } = render(<Harness value={value} onMask={jest.fn()} />);
  await screen.findAllByRole('button', { name: /^Expand (?!all\b)/ });
  await userEvent.click(parentButton(container, 0));
  await screen.findAllByText("Couldn't load Steps —");
  await waitFor(() =>
    expect(statuses(container)[0]).toHaveAttribute('aria-live', 'off'),
  );
  const seen: string[] = [];
  const state = () => {
    const item = statuses(container)[0];
    return `${item?.getAttribute('aria-live')} ${item?.textContent}`;
  };
  let last = state();
  const observer = new MutationObserver(() => {
    const next = state();
    if (next !== last) seen.push(next);
    last = next;
  });
  observer.observe(container, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-live'],
  });
  const release = holdSteps();
  const [retry] = screen.getAllByRole('button', { name: 'Retry' });
  await userEvent.click(retry);
  await waitFor(() =>
    expect(statuses(container)[0]).toHaveTextContent('Loading Steps'),
  );
  expect(statuses(container)[0]).toHaveAttribute('aria-live', 'polite');
  expect(statuses(container)[0].contains(retry)).toBe(false);
  await release();
  await waitFor(() =>
    expect(statuses(container)[0]).toHaveTextContent("Couldn't load Steps —"),
  );
  expect(statuses(container)[0]).toHaveAttribute('aria-live', 'polite');
  await waitFor(() =>
    expect(statuses(container)[0]).toHaveAttribute('aria-live', 'off'),
  );
  observer.disconnect();
  expect(seen).toEqual([
    'polite Loading Steps',
    "polite Couldn't load Steps —",
    "off Couldn't load Steps —",
  ]);
});

test('an open area is a cell of its full-width row and holds the named group', async () => {
  routeSteps(2);
  render(keyboardChart());
  await openFirst();
  await screen.findAllByText('Step 0');
  const [group] = screen.getAllByRole('group', { name: /^Steps of Session/ });
  const cell = group.closest<HTMLElement>('[role="gridcell"], [role="row"]')!;
  expect(cell).toHaveAttribute('role', 'gridcell');
  const row = group.closest('.ag-full-width-row');
  expect(cell.parentElement?.closest('[role]')).toHaveAttribute(
    'role',
    'presentation',
  );
  expect(row).toHaveAttribute('role', 'row');
  expect(cell.closest('[role="row"]')).toBe(row);
  expect(cell).toContainElement(group);
});

test('each +/- column header is named Expand with no visible text', async () => {
  routeSteps(2);
  render(<TreeTableChart {...twoLevels()} />);
  await openFirst();
  await screen.findAllByText('Step 0');
  const headers = await screen.findAllByRole('columnheader', {
    name: 'Expand',
  });
  expect(headers.length).toBeGreaterThanOrEqual(2);
  expect(
    document.querySelectorAll('.ag-header-cell[col-id="tree_table_expand"]'),
  ).toHaveLength(headers.length);
  headers.forEach(header => {
    expect(header).toHaveTextContent(/^\s*$/);
    expect(header).toHaveAttribute('col-id', 'tree_table_expand');
    expect(header).not.toHaveAttribute('aria-sort');
  });
});

test('a leaf detail area is a cell of its full-width row and holds its named group', async () => {
  routeChildren();
  const { container } = render(<TreeTableChart {...twoLevels()} />);
  await openFirst();
  await screen.findAllByText('Greeting');
  await userEvent.click(
    container.querySelector<HTMLElement>(
      '.ag-full-width-row [col-id="tree_table_expand"] button',
    )!,
  );
  const groups = await screen.findAllByRole('group', {
    name: 'Step details',
    hidden: true,
  });
  groups.forEach(group => {
    const cell = group.closest<HTMLElement>('[role="gridcell"], [role="row"]')!;
    expect(cell).toHaveAttribute('role', 'gridcell');
    expect(cell.closest('[role="row"]')).toBe(
      group.closest('.ag-full-width-row'),
    );
    expect(cell).toContainElement(group);
  });
});
