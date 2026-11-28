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
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@superset-ui/core/spec';
import userEventLib from '@testing-library/user-event';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import { GenericDataType } from '@apache-superset/core/common';
import { addTranslation } from '@apache-superset/core/translation';
import ChildTable from './ChildTable';
import buildColumns from './columns';
import { TreeTableContext, TreeTableContextValue } from './TreeTableContext';
import { ChildrenEntry, TreeLevel } from './types';
import { ChildrenContext, ChildrenContextValue } from './useChildren';

beforeAll(setupAGGridModules);
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  id_column: 'session_id',
  columns: [],
  detail_fields: [],
};
const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  name_plural: 'Steps',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['item_desc', 'step'],
  detail_fields: ['result'],
};
const entry: ChildrenEntry = {
  status: 'loaded',
  rows: [
    {
      step_id: 'a',
      session_id: 'S1',
      item_desc: 'Greeting',
      step: 0,
      result: 'ok',
    },
    {
      step_id: 'b',
      session_id: 'S1',
      item_desc: 'Menu',
      step: 1,
      result: null,
    },
    { step_id: null, session_id: 'S1', item_desc: 'Orphan', step: 2 },
  ],
  total: 3,
  colnames: ['step_id', 'session_id', 'item_desc', 'step', 'result'],
  coltypes: [
    GenericDataType.String,
    GenericDataType.String,
    GenericDataType.String,
    GenericDataType.Numeric,
    GenericDataType.String,
  ],
};

function contextValue(
  extra: Partial<TreeTableContextValue> = {},
): TreeTableContextValue {
  return {
    levels: [session, step],
    verboseMap: {},
    data: [],
    colnames: [],
    coltypes: [],
    entries: new Map([['["S1"]', entry]]),
    expanded: new Set(['S1']),
    childExpanded: new Set(),
    toggleChild: jest.fn(),
    retry: jest.fn(),
    buildColumns: (keys, names, types) =>
      buildColumns(keys, names, types, { item_desc: 'Item Desc' }),
    reportHeight: jest.fn(),
    registerGrid: () => () => {},
    ...extra,
  };
}

function childrenValue(
  extra: Partial<ChildrenContextValue> = {},
): ChildrenContextValue {
  return {
    loadMore: jest.fn(),
    sorts: new Map(),
    setSort: jest.fn(),
    areas: new Map(),
    holdFocus: jest.fn(),
    ...extra,
  };
}

const table = (
  value: TreeTableContextValue,
  level: TreeLevel,
  tableEntry: ChildrenEntry,
  children: ChildrenContextValue,
) => (
  <ChildrenContext.Provider value={children}>
    <TreeTableContext.Provider
      value={{ ...value, levels: [value.levels[0], level] }}
    >
      <ChildTable levelIndex={1} entry={tableEntry} parentPath={['S1']} />
    </TreeTableContext.Provider>
  </ChildrenContext.Provider>
);

const renderTable = (
  value: TreeTableContextValue,
  level = step,
  tableEntry = entry,
  children = childrenValue(),
) => render(table(value, level, tableEntry, children));
const userEvent = userEventLib.setup({
  advanceTimers: jest.advanceTimersByTime,
});
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
const tick = () => act(() => jest.advanceTimersByTimeAsync(30));

test('child null values use the translated empty-cell label', async () => {
  addTranslation('N/A', ['Not available']);
  try {
    renderTable(contextValue(), step, {
      ...entry,
      rows: [{ step_id: 'a', item_desc: null, step: 0 }],
    });
    expect(await screen.findByText('Not available')).toBeInTheDocument();
  } finally {
    addTranslation('N/A', ['N/A']);
  }
});

test('a child with no selected columns displays its ID column', async () => {
  const { container } = renderTable(contextValue(), {
    ...step,
    columns: [],
    detail_fields: [],
  });
  expect(await screen.findByText('a')).toBeInTheDocument();
  expect(
    within(container.querySelector('.ag-header')!)
      .getAllByRole('columnheader')
      .map(header => header.getAttribute('col-id')),
  ).toEqual(['step_id']);
});

test('literal dotted child columns display their source value', async () => {
  renderTable(
    contextValue(),
    { ...step, columns: ['metric.value'] },
    {
      ...entry,
      rows: [{ step_id: 'a', 'metric.value': 42, metric: { value: 99 } }],
      colnames: ['step_id', 'metric.value'],
      coltypes: [GenericDataType.String, GenericDataType.Numeric],
    },
  );
  expect(await screen.findByText('42')).toBeInTheDocument();
  expect(screen.queryByText('99')).not.toBeInTheDocument();
});

test('a dataset marker-like field stays a real expandable child row', async () => {
  const childEntry = {
    ...entry,
    rows: [
      {
        step_id: 'a',
        item_desc: 'Greeting',
        step: 0,
        result: 'Child detail',
        __treeTableExpanded: true,
      },
    ],
  };
  const { rerender } = renderTable(contextValue(), step, childEntry);
  expect(await screen.findByText('Greeting')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /^Expand (?!all\b)/ }),
  ).toBeInTheDocument();
  rerender(
    table(
      contextValue({
        childExpanded: new Set(['["S1","a"]']),
        entries: new Map([['["S1"]', childEntry]]),
      }),
      step,
      childEntry,
      childrenValue(),
    ),
  );
  expect(await screen.findByText('Child detail')).toBeInTheDocument();
  expect(screen.getByText('Greeting')).toBeInTheDocument();
});

test('columns are the level Columns in order with dataset labels and server-sorted headers, no filter or menu', async () => {
  const setSort = jest.fn();
  const { container } = renderTable(
    contextValue(),
    step,
    entry,
    childrenValue({ setSort }),
  );
  await screen.findByText('Greeting');
  expect(
    screen
      .getAllByRole('columnheader')
      .map(header => header.getAttribute('col-id')),
  ).toEqual(['tree_table_expand', 'item_desc', 'step']);
  expect(screen.getByText('Item Desc')).toBeInTheDocument();
  expect(
    container.querySelectorAll(
      '.ag-header-cell-menu-button,.ag-header-cell-filter-button,.ag-floating-filter',
    ),
  ).toHaveLength(0);
  const label = container.querySelector(
    '[role="columnheader"][col-id="step"] .ag-header-cell-label',
  )!;
  await userEvent.click(label);
  await waitFor(() =>
    expect(setSort).toHaveBeenLastCalledWith(1, ['step', true], ['S1']),
  );
  await userEvent.click(label);
  await waitFor(() =>
    expect(setSort).toHaveBeenLastCalledWith(1, ['step', false], ['S1']),
  );
  await userEvent.click(label);
  await waitFor(() =>
    expect(setSort).toHaveBeenLastCalledWith(1, undefined, ['S1']),
  );
  expect(screen.getAllByRole('row').map(row => row.textContent)).toEqual(
    expect.arrayContaining(['Greeting0', 'Menu1']),
  );
  const header = container.querySelector<HTMLElement>(
    '[role="columnheader"][col-id="item_desc"]',
  )!;
  header.focus();
  fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' });
  await waitFor(() =>
    expect(setSort).toHaveBeenLastCalledWith(1, ['item_desc', true], ['S1']),
  );
  expect(setSort).toHaveBeenCalledTimes(4);
  expect(
    container.querySelector(
      '[role="columnheader"][col-id="tree_table_expand"]',
    ),
  ).not.toHaveAttribute('aria-sort');
});

test('a sort set through the context shows on the header without calling setSort again', async () => {
  const setSort = jest.fn();
  const value = contextValue();
  const sortedStep: TreeLevel = { ...step, sort: ['step', true] };
  const { container, rerender } = renderTable(
    value,
    sortedStep,
    entry,
    childrenValue({ setSort }),
  );
  await screen.findByText('Greeting');
  rerender(
    table(
      value,
      sortedStep,
      entry,
      childrenValue({ setSort, sorts: new Map([[1, ['step', false]]]) }),
    ),
  );
  const header = () =>
    container.querySelector('[role="columnheader"][col-id="step"]');
  await waitFor(() =>
    expect(header()).toHaveAttribute('aria-sort', 'descending'),
  );
  rerender(table(value, sortedStep, entry, childrenValue({ setSort })));
  await waitFor(() =>
    expect(header()).toHaveAttribute('aria-sort', 'ascending'),
  );
  await tick();
  expect(setSort).not.toHaveBeenCalled();
  expect(
    container.querySelectorAll('.ag-sort-indicator-icon:not(.ag-hidden)'),
  ).toHaveLength(1);
});

test('child +/- shows for rows with an ID only when the level has detail fields', async () => {
  const toggleChild = jest.fn();
  renderTable(contextValue({ toggleChild }));
  await screen.findByText('Orphan');
  const buttons = screen.getAllByRole('button', { name: /^Expand (?!all\b)/ });
  expect(buttons).toHaveLength(2);
  await userEvent.click(buttons[1]);
  expect(toggleChild).toHaveBeenCalledWith(['S1', 'b']);
});

test('no detail fields gives no +/- column', async () => {
  renderTable(contextValue(), { ...step, detail_fields: [] });
  await screen.findByText('Greeting');
  expect(
    screen
      .getAllByRole('columnheader')
      .map(header => header.getAttribute('col-id')),
  ).toEqual(['item_desc', 'step']);
  expect(
    screen.queryByRole('button', { name: /^Expand (?!all\b)/ }),
  ).not.toBeInTheDocument();
});

test('an open child row shows the level 2 detail block under that row only', async () => {
  const { container } = renderTable(
    contextValue({ childExpanded: new Set([JSON.stringify(['S1', 'b'])]) }),
  );
  await screen.findByRole('group', { name: 'Step details' });
  expect(screen.getAllByRole('group', { name: 'Step details' })).toHaveLength(
    1,
  );
  expect(
    screen.getByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toBeInTheDocument();
  const fullWidth = container.querySelector<HTMLElement>('.ag-full-width-row')!;
  expect(
    within(fullWidth).getByRole('group', { name: 'Step details' }),
  ).toBeInTheDocument();
  expect(fullWidth).toHaveTextContent('N/A');
  await waitFor(() => expect(fullWidth.getAttribute('row-index')).toBe('2'));
});

test('Enter and Space on a focused child +/- cell toggle once per press; focus goes into its button', async () => {
  const toggleChild = jest.fn();
  const { container } = renderTable(contextValue({ toggleChild }));
  await screen.findByText('Greeting');
  const cell = container.querySelector<HTMLElement>(
    '.ag-grid-scrolling-container > [row-index="0"] [col-id="tree_table_expand"]',
  )!;
  cell.focus();
  fireEvent.keyDown(cell, { key: 'Enter', code: 'Enter' });
  expect(toggleChild).toHaveBeenCalledTimes(1);
  expect(toggleChild).toHaveBeenLastCalledWith(['S1', 'a']);
  fireEvent.keyDown(cell, { key: ' ', code: 'Space' });
  fireEvent.keyDown(cell, { key: ' ', code: 'Space', repeat: true });
  expect(toggleChild).toHaveBeenCalledTimes(2);
  expect(document.activeElement).toBe(cell.querySelector('button'));
  const blank = container.querySelector<HTMLElement>(
    '.ag-grid-scrolling-container > [row-index="2"] [col-id="tree_table_expand"]',
  )!;
  blank.focus();
  fireEvent.keyDown(blank, { key: 'Enter', code: 'Enter' });
  expect(toggleChild).toHaveBeenCalledTimes(2);
});

test('a middle level without detail fields still gets a +/- column when a level sits below it', async () => {
  const toggleChild = jest.fn();
  const action: TreeLevel = {
    key: 'action',
    name: 'Action',
    id_column: 'action_id',
    parent_column: 'step_id',
    columns: [],
    detail_fields: [],
  };
  render(
    <ChildrenContext.Provider value={childrenValue()}>
      <TreeTableContext.Provider
        value={contextValue({
          levels: [session, { ...step, detail_fields: [] }, action],
          toggleChild,
        })}
      >
        <ChildTable levelIndex={1} entry={entry} parentPath={['S1']} />
      </TreeTableContext.Provider>
    </ChildrenContext.Provider>,
  );
  await screen.findByText('Greeting');
  expect(
    screen
      .getAllByRole('columnheader')
      .map(header => header.getAttribute('col-id')),
  ).toEqual(['tree_table_expand', 'item_desc', 'step']);
  await userEvent.click(
    screen.getAllByRole('button', { name: /^Expand (?!all\b)/ })[0],
  );
  expect(toggleChild).toHaveBeenCalledWith(['S1', 'a']);
});
