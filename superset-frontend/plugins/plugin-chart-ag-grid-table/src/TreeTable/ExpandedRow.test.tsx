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
import { ReactNode, useLayoutEffect } from 'react';
import { act, render, screen, waitFor, within } from '@superset-ui/core/spec';
import userEvent from '@testing-library/user-event';
import { addTranslation } from '@apache-superset/core/translation';
import {
  setupAGGridModules,
  ThemedAgGridReact,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { GenericDataType } from '@apache-superset/core/common';
import {
  ClientSideRowModelApiModule,
  ICellRendererParams,
} from 'ag-grid-community';
import ExpandedRow, { AreaStatusContext, LIVE_HOLD_MS } from './ExpandedRow';
import buildColumns from './columns';
import { TreeTableContainer } from './styles';
import {
  createMarker,
  isMarker,
  TreeTableContext,
  TreeTableContextValue,
  useRowHeights,
} from './TreeTableContext';
import { AreaState, ChildrenEntry, ExpandedMarker, TreeLevel } from './types';
import { ChildrenContext, ChildrenContextValue } from './useChildren';

let observed: { callback: ResizeObserverCallback; element: Element }[] = [];
let reportedHeight = 0;
beforeAll(setupAGGridModules);
beforeEach(() => {
  observed = [];
  reportedHeight = 0;
  global.ResizeObserver = class {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(element: Element) {
      observed.push({ callback: this.callback, element });
      if (reportedHeight)
        this.callback(
          [
            {
              contentRect: { height: reportedHeight },
              target: element,
            } as unknown as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
    }

    unobserve() {}

    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  id_column: 'session_id',
  columns: ['channel'],
  detail_fields: ['inbound_number', 'web_chat_id'],
};
const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  name_plural: 'Steps',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['item_desc', 'step'],
  detail_fields: [],
};
const marker: ExpandedMarker = createMarker({
  __treeTableExpanded: true,
  parentKey: 'S1',
  parentIndex: 0,
  path: ['S1'],
});
const loaded: ChildrenEntry = {
  status: 'loaded',
  rows: [
    { step_id: 'a', session_id: 'S1', item_desc: 'Greeting', step: 0 },
    { step_id: 'b', session_id: 'S1', item_desc: 'Menu', step: 1 },
  ],
  total: 2,
  colnames: ['step_id', 'session_id', 'item_desc', 'step'],
  coltypes: [
    GenericDataType.String,
    GenericDataType.String,
    GenericDataType.String,
    GenericDataType.Numeric,
  ],
};

function contextValue(
  extra: Partial<TreeTableContextValue> = {},
): TreeTableContextValue {
  return {
    levels: [session, step],
    verboseMap: { inbound_number: 'inboundNumber', item_desc: 'Item Desc' },
    data: [{ session_id: 'S1', inbound_number: '+1 555', web_chat_id: null }],
    colnames: ['session_id', 'inbound_number', 'web_chat_id'],
    coltypes: [
      GenericDataType.String,
      GenericDataType.String,
      GenericDataType.String,
    ],
    entries: new Map(),
    expanded: new Set(['S1']),
    childExpanded: new Set(),
    toggleChild: jest.fn(),
    retry: jest.fn(),
    buildColumns: (keys, names, types) =>
      buildColumns(keys, names, types, {
        inbound_number: 'inboundNumber',
        item_desc: 'Item Desc',
      }),
    reportHeight: jest.fn(),
    registerGrid: () => () => {},
    ...extra,
  };
}

const renderRow = (value: TreeTableContextValue, children?: ReactNode) =>
  render(
    <TreeTableContext.Provider value={value}>
      {children ?? (
        <ExpandedRow
          {...({ data: marker } as ICellRendererParams<ExpandedMarker>)}
        />
      )}
    </TreeTableContext.Provider>,
  );

test('detail block uses the title fallback, verbose labels and N/A', () => {
  renderRow(contextValue());
  expect(
    screen.getByRole('group', { name: 'Session details' }),
  ).toBeInTheDocument();
  expect(screen.getByText('inboundNumber')).toBeInTheDocument();
  expect(screen.getByText('+1 555')).toBeInTheDocument();
  expect(screen.getByText('web_chat_id')).toBeInTheDocument();
  expect(screen.getByText('N/A')).toBeInTheDocument();
});

test('detail null values use the translated empty-cell label', () => {
  addTranslation('N/A', ['Not available']);
  try {
    renderRow(contextValue());
    expect(screen.getByText('Not available')).toBeInTheDocument();
  } finally {
    addTranslation('N/A', ['N/A']);
  }
});

test('no detail fields shows no detail block', () => {
  renderRow(
    contextValue({
      levels: [{ ...session, detail_fields: [] }, step],
      entries: new Map([['["S1"]', { ...loaded, status: 'empty' }]]),
    }),
  );
  expect(screen.queryByText('Session details')).not.toBeInTheDocument();
  expect(screen.getByText('No Steps')).toBeInTheDocument();
});

test('loading shows the skeleton inside a loading element', () => {
  const { container } = renderRow(contextValue());
  expect(
    container.querySelector('.loading .ant-skeleton-active'),
  ).toBeInTheDocument();
});

test('empty shows No {children}, with the name when no plural is set', () => {
  renderRow(
    contextValue({
      levels: [session, { ...step, name_plural: undefined }],
      entries: new Map([['["S1"]', { ...loaded, status: 'empty' }]]),
    }),
  );
  expect(screen.getByText('No Step')).toBeInTheDocument();
  expect(screen.queryByRole('grid')).not.toBeInTheDocument();
});

test('error shows the message and a Retry for that row', async () => {
  const retry = jest.fn();
  renderRow(
    contextValue({
      retry,
      entries: new Map([['["S1"]', { ...loaded, status: 'error', rows: [] }]]),
    }),
  );
  expect(screen.getByText("Couldn't load Steps —")).toHaveClass(
    'ant-typography-danger',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledWith(['S1']);
});

test('the error separator belongs to the translation and Retry stays separate', () => {
  const key = "Couldn't load %s —";
  addTranslation(key, ['— %s unavailable']);
  try {
    renderRow(
      contextValue({
        entries: new Map([['["S1"]', { ...loaded, status: 'error' }]]),
      }),
    );
    expect(screen.getByText('— Steps unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  } finally {
    addTranslation(key, [key]);
  }
});

test('loaded shows the child table and the count line', async () => {
  renderRow(contextValue({ entries: new Map([['["S1"]', loaded]]) }));
  expect(await screen.findByText('Greeting')).toBeInTheDocument();
  expect(screen.getByText('Item Desc')).toBeInTheDocument();
  expect(screen.getByText('2 Steps')).toBeInTheDocument();
});

test.each([
  [1, '1 Step'],
  [2, '2 Steps'],
])('count %s selects the author singular or plural name', (total, text) => {
  renderRow(
    contextValue({
      entries: new Map([
        ['["S1"]', { ...loaded, rows: loaded.rows.slice(0, total), total }],
      ]),
    }),
  );
  expect(screen.getByText(text)).toBeInTheDocument();
});

test('one level opens to the detail block only', () => {
  const { container } = renderRow(contextValue({ levels: [session] }));
  expect(
    screen.getByRole('group', { name: 'Session details' }),
  ).toBeInTheDocument();
  expect(container.querySelector('.loading')).not.toBeInTheDocument();
});

test('reports its measured height under the marker row id', () => {
  reportedHeight = 212;
  const reportHeight = jest.fn();
  renderRow(contextValue({ reportHeight }));
  expect(reportHeight).toHaveBeenCalledWith('marker-0', 212);
});

function HeightHarness({ order }: { order: string[] }) {
  const heights = useRowHeights();
  const value = contextValue({
    levels: [session],
    reportHeight: (rowId, height) => {
      order.push(`report ${height} api=${Boolean(heights.api.current)}`);
      heights.reportHeight(rowId, height);
    },
  });
  return (
    <TreeTableContext.Provider value={value}>
      <div style={{ height: 400, width: 600 }}>
        <ThemedAgGridReact
          modules={[ClientSideRowModelApiModule]}
          rowData={[value.data[0], marker]}
          columnDefs={[{ field: 'session_id' }]}
          getRowId={({ data }) =>
            isMarker(data) ? 'marker-0' : String(data.session_id)
          }
          isFullWidthRow={({ rowNode }) => isMarker(rowNode.data)}
          fullWidthCellRenderer={ExpandedRow}
          getRowHeight={({ data }) =>
            isMarker(data)
              ? (heights.heights.current.get('marker-0') ?? 40)
              : undefined
          }
          onGridReady={({ api }) => {
            order.push('gridReady');
            heights.onReady(api);
          }}
        />
      </div>
    </TreeTableContext.Provider>
  );
}

test('a height measured before gridReady is applied once the grid is ready', async () => {
  reportedHeight = 333;
  const gridErrors = jest.spyOn(console, 'error');
  const order: string[] = [];
  const { container } = render(<HeightHarness order={order} />);
  await waitFor(() => expect(order).toContain('gridReady'));
  await waitFor(() =>
    expect(
      container.querySelector<HTMLElement>('.ag-full-width-row')?.style.height,
    ).toBe('333px'),
  );
  expect(order[0]).toBe('report 333 api=false');
  expect(gridErrors.mock.calls.flat().join(' ')).not.toContain(
    'AG Grid: error',
  );
  gridErrors.mockRestore();
});

test('a level-2 row opens to its own detail block, then the level-3 table of its path', async () => {
  const action: TreeLevel = {
    key: 'action',
    name: 'Action',
    name_plural: 'Actions',
    id_column: 'action_id',
    parent_column: 'step_id',
    columns: ['action_type'],
    detail_fields: [],
  };
  const actions: ChildrenEntry = {
    status: 'loaded',
    rows: [{ action_id: 'x1', step_id: 'b', action_type: 'Play' }],
    total: 1,
    colnames: ['action_id', 'step_id', 'action_type'],
    coltypes: [
      GenericDataType.String,
      GenericDataType.String,
      GenericDataType.String,
    ],
  };
  render(
    <TreeTableContext.Provider
      value={contextValue({
        levels: [session, { ...step, detail_fields: ['item_desc'] }, action],
        entries: new Map([
          ['["S1"]', loaded],
          ['["S1","b"]', actions],
        ]),
      })}
    >
      <ExpandedRow
        {...({
          data: {
            __treeTableExpanded: true,
            parentKey: 'b',
            parentIndex: 1,
            path: ['S1', 'b'],
          },
          context: { parentPath: ['S1'], reportHeight: jest.fn() },
        } as unknown as ICellRendererParams<ExpandedMarker>)}
      />
    </TreeTableContext.Provider>,
  );
  expect(
    screen.getByRole('group', { name: 'Step details' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Menu')).toBeInTheDocument();
  expect(await screen.findByText('Play')).toBeInTheDocument();
  expect(screen.getByText('1 Action')).toBeInTheDocument();
});

test.each([true, false])(
  'empty range copy follows the answer inRange=%s',
  inRange => {
    renderRow(
      contextValue({
        entries: new Map([
          ['["S1"]', { ...loaded, rows: [], status: 'empty', inRange }],
        ]),
      }),
    );
    expect(
      screen.getByText(inRange ? 'No Steps in the selected range' : 'No Steps'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  },
);

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

const userArea = (extra: Partial<AreaState> = {}): AreaState => ({
  path: ['S1'],
  level: 1,
  action: 'expand',
  origin: 'user',
  state: 'loaded',
  ...extra,
});

/** Reads the status text in the commit that mounts the area, before passive effects. */
function MountProbe({ seen }: { seen: string[] }) {
  useLayoutEffect(() => {
    seen.push(document.querySelector('.tree-table-status')?.textContent ?? '');
  }, [seen]);
  return null;
}

const statusRow = (
  value: TreeTableContextValue,
  speaking: Set<string>,
  children = childrenValue(),
  seen: string[] = [],
) => (
  <AreaStatusContext.Provider value={speaking}>
    <ChildrenContext.Provider value={children}>
      <TreeTableContext.Provider value={value}>
        <ExpandedRow
          {...({ data: marker } as ICellRendererParams<ExpandedMarker>)}
        />
        <MountProbe seen={seen} />
      </TreeTableContext.Provider>
    </ChildrenContext.Provider>
  </AreaStatusContext.Provider>
);

const status = () => document.querySelector<HTMLElement>('.tree-table-status')!;
const wait = (ms: number) =>
  act(() => new Promise(resolve => setTimeout(resolve, ms)));

test('a user open: the status mounts empty, is polite with "Loading Steps", then the count line, then off', async () => {
  const speaking = new Set(['["S1"]']);
  const seen: string[] = [];
  const { container, rerender } = render(
    statusRow(contextValue(), speaking, childrenValue(), seen),
  );
  expect(seen).toEqual(['']);
  await waitFor(() => expect(status()).toHaveTextContent('Loading Steps'));
  expect(status()).toHaveAttribute('aria-live', 'polite');
  expect(status()).toHaveAttribute('aria-atomic', 'true');
  expect(status()).not.toHaveAttribute('role');
  const skeleton = container.querySelector('.loading')!;
  expect(skeleton).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
  expect(skeleton.contains(status())).toBe(false);
  expect(status().closest('[aria-busy]')).toBeNull();
  rerender(
    statusRow(
      contextValue({
        entries: new Map([['["S1"]', { ...loaded, total: 143 }]]),
      }),
      speaking,
    ),
  );
  expect(status()).toHaveTextContent('2 of 143 Steps');
  expect(status()).toHaveAttribute('aria-live', 'polite');
  expect(speaking.has('["S1"]')).toBe(false);
  await wait(LIVE_HOLD_MS + 50);
  expect(status()).toHaveAttribute('aria-live', 'off');
});

test('a user open from an already loaded batch (or a reopen after Collapse all) sets its text after mount and speaks it', async () => {
  const speaking = new Set(['["S1"]']);
  const seen: string[] = [];
  render(
    statusRow(
      contextValue({ entries: new Map([['["S1"]', loaded]]) }),
      speaking,
      childrenValue(),
      seen,
    ),
  );
  expect(seen).toEqual(['']);
  await waitFor(() => expect(status()).toHaveTextContent('2 Steps'));
  expect(status()).toHaveAttribute('aria-live', 'polite');
  await wait(LIVE_HOLD_MS + 50);
  expect(status()).toHaveAttribute('aria-live', 'off');
});

test('a re-mount without a user action (row scrolled back into view) shows its text at mount with aria-live off', () => {
  const seen: string[] = [];
  render(
    statusRow(
      contextValue({ entries: new Map([['["S1"]', loaded]]) }),
      new Set(),
      childrenValue(),
      seen,
    ),
  );
  expect(seen).toEqual(['2 Steps']);
  expect(status()).toHaveAttribute('aria-live', 'off');
});

test('areas opened by Expand all, refreshed or re-sorted stay off through loading and new counts', () => {
  const speaking = new Set<string>();
  const { rerender } = render(statusRow(contextValue(), speaking));
  expect(status()).toHaveTextContent('Loading Steps');
  expect(status()).toHaveAttribute('aria-live', 'off');
  rerender(
    statusRow(
      contextValue({
        entries: new Map([['["S1"]', { ...loaded, total: 150 }]]),
      }),
      speaking,
    ),
  );
  expect(status()).toHaveTextContent('2 of 150 Steps');
  expect(status()).toHaveAttribute('aria-live', 'off');
  rerender(
    statusRow(
      contextValue({ entries: new Map([['["S1"]', loaded]]) }),
      speaking,
      childrenValue({
        areas: new Map([['["S1"]', userArea({ action: 'child-sort' })]]),
      }),
    ),
  );
  expect(status()).toHaveTextContent('2 Steps');
  expect(status()).toHaveAttribute('aria-live', 'off');
});

test.each([
  [{ status: 'empty' as const, inRange: false }, 'No Steps'],
  [
    { status: 'empty' as const, inRange: true },
    'No Steps in the selected range',
  ],
  [{ status: 'error' as const }, "Couldn't load Steps —"],
])('the status holds the area state text (%o)', async (change, text) => {
  render(
    statusRow(
      contextValue({
        entries: new Map([['["S1"]', { ...loaded, rows: [], ...change }]]),
      }),
      new Set(['["S1"]']),
    ),
  );
  await waitFor(() => expect(status()).toHaveTextContent(text));
  expect(status()).toHaveAttribute('aria-live', 'polite');
  const retry = screen.queryByRole('button', { name: 'Retry' });
  if (retry) expect(status().contains(retry)).toBe(false);
});

test('Retry: outside the status; pressing it makes the status live until the new result lands', async () => {
  const retry = jest.fn();
  const speaking = new Set<string>();
  const errorEntry = { ...loaded, status: 'error' as const, rows: [] };
  const value = (entry: ChildrenEntry) =>
    contextValue({ retry, entries: new Map([['["S1"]', entry]]) });
  const { rerender } = render(statusRow(value(errorEntry), speaking));
  expect(status()).toHaveAttribute('aria-live', 'off');
  const button = screen.getByRole('button', { name: 'Retry' });
  expect(status().contains(button)).toBe(false);
  await userEvent.click(button);
  expect(retry).toHaveBeenCalledWith(['S1']);
  expect(status()).toHaveAttribute('aria-live', 'polite');
  const retrying = childrenValue({
    areas: new Map([
      ['["S1"]', userArea({ action: 'retry', state: 'loading' })],
    ]),
  });
  rerender(
    statusRow(value({ ...errorEntry, status: 'loading' }), speaking, retrying),
  );
  expect(status()).toHaveAttribute('aria-live', 'polite');
  rerender(
    statusRow(
      value(loaded),
      speaking,
      childrenValue({
        areas: new Map([['["S1"]', userArea({ action: 'retry' })]]),
      }),
    ),
  );
  expect(status()).toHaveTextContent('2 Steps');
  expect(status()).toHaveAttribute('aria-live', 'polite');
  await wait(LIVE_HOLD_MS + 50);
  expect(status()).toHaveAttribute('aria-live', 'off');
});

const moreEntry: ChildrenEntry = { ...loaded, total: 5 };

test('count lines format loaded and total integers, including the completed count', () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({
    ...loaded.rows[0],
    step_id: `step-${index}`,
  }));
  const value = (total: number) =>
    contextValue({
      entries: new Map([['["S1"]', { ...loaded, rows, total }]]),
    });
  const { rerender } = render(statusRow(value(1284), new Set()));
  expect(status()).toHaveTextContent('1,001 of 1,284 Steps');
  rerender(statusRow(value(1001), new Set()));
  expect(status()).toHaveTextContent('1,001 Steps');
});

test('the count line shows loaded of total, then the total once all are loaded', () => {
  const { rerender } = render(
    statusRow(
      contextValue({ entries: new Map([['["S1"]', moreEntry]]) }),
      new Set(),
    ),
  );
  expect(status()).toHaveTextContent('2 of 5 Steps');
  rerender(
    statusRow(
      contextValue({ entries: new Map([['["S1"]', loaded]]) }),
      new Set(),
    ),
  );
  expect(status()).toHaveTextContent('2 Steps');
});

test('Load more: outside the status, keeps its node while pending and on error; the status speaks "5 Steps" or the Load-more error', async () => {
  const loadMore = jest.fn();
  const holdFocus = jest.fn();
  const speaking = new Set<string>();
  const children = childrenValue({ loadMore, holdFocus });
  const value = (entry: ChildrenEntry) =>
    contextValue({ entries: new Map([['["S1"]', entry]]) });
  const { rerender } = render(statusRow(value(moreEntry), speaking, children));
  const button = screen.getByRole('button', { name: 'Load more' });
  expect(status().contains(button)).toBe(false);
  expect(status()).toHaveAttribute('aria-live', 'off');
  button.focus();
  await userEvent.keyboard('{Enter}');
  expect(loadMore).toHaveBeenCalledWith(['S1']);
  expect(holdFocus).toHaveBeenCalledWith(['S1'], button, expect.any(Function));
  expect(status()).toHaveAttribute('aria-live', 'polite');
  rerender(
    statusRow(value({ ...moreEntry, more: 'loading' }), speaking, children),
  );
  const pending = screen.getByRole('button', { name: /Load more/ });
  expect(pending.isSameNode(button)).toBe(true);
  expect(pending).toHaveClass('ant-btn-loading');
  expect(document.activeElement).toBe(button);
  rerender(
    statusRow(value({ ...moreEntry, more: 'error' }), speaking, children),
  );
  expect(status()).toHaveTextContent(/^2 of 5 Steps\s*Couldn't load Steps —$/);
  expect(status()).toHaveAttribute('aria-live', 'polite');
  expect(screen.getByText("Couldn't load Steps —")).toHaveClass(
    'ant-typography-danger',
  );
  expect(screen.getByText('2 of 5 Steps')).toHaveClass(
    'ant-typography-secondary',
  );
  const retry = screen.getByRole('button', { name: 'Retry' });
  expect(retry.isSameNode(button)).toBe(true);
  expect(status().contains(retry)).toBe(false);
  await wait(LIVE_HOLD_MS + 50);
  expect(status()).toHaveAttribute('aria-live', 'off');
  await userEvent.click(retry);
  expect(loadMore).toHaveBeenCalledTimes(2);
  expect(status()).toHaveAttribute('aria-live', 'polite');
  const retrying = childrenValue({
    loadMore,
    holdFocus,
    areas: new Map([
      ['["S1"]', userArea({ action: 'retry', more: 'loading' })],
    ]),
  });
  rerender(
    statusRow(value({ ...moreEntry, more: 'loading' }), speaking, retrying),
  );
  expect(screen.getByRole('button', { name: /Retry/ }).isSameNode(button)).toBe(
    true,
  );
  expect(status()).toHaveTextContent(/^2 of 5 Steps\s*Loading Steps$/);
  rerender(
    statusRow(
      value({
        ...loaded,
        rows: [...loaded.rows, ...loaded.rows, loaded.rows[0]],
        total: 5,
      }),
      speaking,
      retrying,
    ),
  );
  expect(status()).toHaveTextContent('5 Steps');
  expect(status()).toHaveAttribute('aria-live', 'polite');
  expect(screen.queryByRole('button', { name: /Load more|Retry/ })).toBeNull();
});

test('names: the child grid area is a group "Steps of Session S1"; the detail block is a group named by its title', async () => {
  render(
    statusRow(
      contextValue({ entries: new Map([['["S1"]', loaded]]) }),
      new Set(),
    ),
  );
  const group = screen.getByRole('group', { name: 'Steps of Session S1' });
  expect(await within(group).findByText('Greeting')).toBeInTheDocument();
  expect(group.contains(status())).toBe(true);
  expect(
    screen.getByRole('group', { name: 'Session details' }),
  ).toHaveTextContent('inboundNumber+1 555web_chat_idN/A');
});

test('names: a level-2 area is named by its own parent row', () => {
  render(
    <ChildrenContext.Provider value={childrenValue()}>
      <TreeTableContext.Provider
        value={contextValue({
          levels: [
            session,
            { ...step, detail_fields: ['item_desc'] },
            { ...step, key: 'action', name: 'Action', name_plural: 'Actions' },
          ],
          entries: new Map([['["S1"]', loaded]]),
        })}
      >
        <ExpandedRow
          {...({
            data: {
              __treeTableExpanded: true,
              parentKey: 'b',
              parentIndex: 1,
              path: ['S1', 'b'],
            },
            context: { parentPath: ['S1'], reportHeight: jest.fn() },
          } as unknown as ICellRendererParams<ExpandedMarker>)}
        />
      </TreeTableContext.Provider>
    </ChildrenContext.Provider>,
  );
  expect(
    screen.getByRole('group', { name: 'Actions of Step b' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('group', { name: 'Step details' }),
  ).toBeInTheDocument();
});

test('a collapse removes the area and its status: no late text', () => {
  const speaking = new Set(['["S1"]']);
  const { unmount } = render(statusRow(contextValue(), speaking));
  unmount();
  expect(document.querySelector('.tree-table-status')).toBeNull();
});

test.each([
  ['a refresh', userArea({ action: 'refresh', origin: 'refresh' })],
  ['a child sort', userArea({ action: 'child-sort' })],
  ['Expand all', userArea({ action: 'expand-all', origin: 'expand-all' })],
])(
  '%s that supersedes a pending user open ends its live window; the replacement result stays off',
  async (_name, superseding) => {
    const speaking = new Set(['["S1"]']);
    const opening = childrenValue({
      areas: new Map([['["S1"]', userArea({ state: 'loading' })]]),
    });
    const { rerender } = render(statusRow(contextValue(), speaking, opening));
    await waitFor(() => expect(status()).toHaveTextContent('Loading Steps'));
    expect(status()).toHaveAttribute('aria-live', 'polite');
    const replaced = childrenValue({
      areas: new Map([['["S1"]', { ...superseding, state: 'loading' }]]),
    });
    rerender(statusRow(contextValue(), speaking, replaced));
    await waitFor(() => expect(status()).toHaveAttribute('aria-live', 'off'));
    expect(speaking.has('["S1"]')).toBe(false);
    rerender(
      statusRow(
        contextValue({ entries: new Map([['["S1"]', loaded]]) }),
        speaking,
        childrenValue({ areas: new Map([['["S1"]', superseding]]) }),
      ),
    );
    expect(status()).toHaveTextContent('2 Steps');
    expect(status()).toHaveAttribute('aria-live', 'off');
  },
);

const action: TreeLevel = {
  key: 'action',
  name: 'Action',
  name_plural: 'Actions',
  id_column: 'action_id',
  parent_column: 'step_id',
  columns: ['action_type'],
  detail_fields: [],
};

test.each([
  ['Load more', { ...moreEntry, more: 'loading' as const }, undefined],
  [
    'a refresh',
    moreEntry,
    userArea({ action: 'refresh', origin: 'refresh', state: 'loading' }),
  ],
])(
  'during an ancestor %s no element holding a status (a nested one included) is aria-busy',
  async (_name, entry, area) => {
    const nested = '["S1","b"]';
    render(
      statusRow(
        contextValue({
          levels: [session, step, action],
          entries: new Map([['["S1"]', entry]]),
          childExpanded: new Set([nested]),
        }),
        new Set([nested]),
        childrenValue({ areas: new Map(area ? [['["S1"]', area]] : []) }),
      ),
    );
    const nestedStatus = await waitFor(() => {
      const found = [...document.querySelectorAll('.tree-table-status')].find(
        item => item.textContent === 'Loading Actions',
      );
      expect(found).toBeDefined();
      return found!;
    });
    const all = [...document.querySelectorAll('.tree-table-status')];
    expect(all).toHaveLength(2);
    expect(nestedStatus).toHaveAttribute('aria-live', 'polite');
    all.forEach(item => expect(item.closest('[aria-busy]')).toBeNull());
    expect(document.querySelector('.loading')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  },
);

/** Every status text change, as "aria-live text". */
function watchStatus() {
  const seen: string[] = [];
  let last = '';
  const observer = new MutationObserver(() => {
    const next = `${status().getAttribute('aria-live')} ${status().textContent}`;
    if (next !== last) seen.push(next);
    last = next;
  });
  observer.observe(status(), {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  return { seen, stop: () => observer.disconnect() };
}

test('a Retry that fails again with the same error goes "Loading Steps" → the error, live in the user\'s window, then off', async () => {
  const speaking = new Set<string>();
  const errorEntry = { ...loaded, status: 'error' as const, rows: [] };
  const value = (entry: ChildrenEntry) =>
    contextValue({ entries: new Map([['["S1"]', entry]]) });
  const retried = childrenValue({
    areas: new Map([['["S1"]', userArea({ action: 'retry', state: 'error' })]]),
  });
  const { rerender } = render(statusRow(value(errorEntry), speaking));
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  const watch = watchStatus();
  rerender(
    statusRow(
      value({ ...errorEntry, status: 'loading' }),
      speaking,
      childrenValue({
        areas: new Map([
          ['["S1"]', userArea({ action: 'retry', state: 'loading' })],
        ]),
      }),
    ),
  );
  await waitFor(() => expect(status()).toHaveTextContent('Loading Steps'));
  expect(status()).toHaveAttribute('aria-live', 'polite');
  const retry = screen.getByRole('button', { name: /Retry/ });
  expect(status().contains(retry)).toBe(false);
  rerender(statusRow(value(errorEntry), speaking, retried));
  await waitFor(() =>
    expect(status()).toHaveTextContent("Couldn't load Steps —"),
  );
  expect(status()).toHaveAttribute('aria-live', 'polite');
  await wait(LIVE_HOLD_MS + 50);
  expect(status()).toHaveAttribute('aria-live', 'off');
  watch.stop();
  expect(watch.seen).toEqual([
    'polite Loading Steps',
    "polite Couldn't load Steps —",
    "off Couldn't load Steps —",
  ]);
});

test('a Load-more Retry that fails again shows "Loading Steps" while pending, then the same error as a change', async () => {
  const speaking = new Set<string>();
  const value = (entry: ChildrenEntry) =>
    contextValue({ entries: new Map([['["S1"]', entry]]) });
  const children = (area?: AreaState) =>
    childrenValue({ areas: new Map(area ? [['["S1"]', area]] : []) });
  const { rerender } = render(
    statusRow(value({ ...moreEntry, more: 'error' }), speaking, children()),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  const watch = watchStatus();
  rerender(
    statusRow(
      value({ ...moreEntry, more: 'loading' }),
      speaking,
      children(userArea({ action: 'retry', more: 'loading' })),
    ),
  );
  await waitFor(() =>
    expect(status()).toHaveTextContent(/^2 of 5 Steps\s*Loading Steps$/),
  );
  expect(status()).toHaveAttribute('aria-live', 'polite');
  rerender(
    statusRow(
      value({ ...moreEntry, more: 'error' }),
      speaking,
      children(userArea({ action: 'retry', more: 'error' })),
    ),
  );
  await waitFor(() =>
    expect(status()).toHaveTextContent(
      /^2 of 5 Steps\s*Couldn't load Steps —$/,
    ),
  );
  expect(status()).toHaveAttribute('aria-live', 'polite');
  await wait(LIVE_HOLD_MS + 50);
  expect(status()).toHaveAttribute('aria-live', 'off');
  watch.stop();
  expect(watch.seen.map(item => item.split(' ')[0])).toEqual([
    'polite',
    'polite',
    'off',
  ]);
});

test('detail fields put each label above its value without a visible heading', () => {
  const { container } = renderRow(contextValue());
  const fields = container.querySelector('.tree-table-detail-fields')!;
  expect(fields.children).toHaveLength(2);
  expect(fields.children[0].children[0]).toHaveTextContent('inboundNumber');
  expect(fields.children[0].children[1]).toHaveTextContent('+1 555');
  expect(screen.queryByText('Session details')).not.toBeInTheDocument();
});

test('detail fields can shrink and wrap unbroken identifiers', () => {
  render(<TreeTableContainer height={400} data-test="tree-table-styles" />);
  expect(screen.getByTestId('tree-table-styles')).toHaveStyleRule(
    'min-width',
    '0',
    {
      target: /\.tree-table-detail-fields\s*>\s*\*/,
    },
  );
  expect(screen.getByTestId('tree-table-styles')).toHaveStyleRule(
    'overflow-wrap',
    'anywhere',
    {
      target: /\.tree-table-detail-fields\s*>\s*\*/,
    },
  );
  expect(screen.getByTestId('tree-table-styles')).toHaveStyleRule(
    'white-space',
    'normal',
    {
      target: /\.tree-table-detail-fields\s*>\s*\*/,
    },
  );
});

test('open areas use quiet primary tints, a pale child bar and a bordered expand box', () => {
  render(<TreeTableContainer height={400} data-test="tree-table-styles" />);
  const styles = screen.getByTestId('tree-table-styles');
  expect(styles).toHaveStyleRule(
    'background',
    expect.stringMatching(/^color-mix\(in srgb, .+ 1\.5%, .+\)$/),
    { target: / \.ag-full-width-row$/ },
  );
  expect(styles).toHaveStyleRule(
    'background',
    expect.stringMatching(/^color-mix\(in srgb, .+ 4\.5%, .+\)$/),
    { target: /\[aria-expanded='true'\]/ },
  );
  expect(styles).toHaveStyleRule(
    'border-inline-start',
    expect.stringMatching(/^3px solid color-mix\(in srgb, .+ 36%, .+\)$/),
    { target: / \.tree-table-child-group$/ },
  );
  expect(styles).toHaveStyleRule('width', '16px', {
    target: /\.ant-btn\.tree-table-expand$/,
  });
  expect(styles).toHaveStyleRule('border-radius', '3px', {
    target: /\.ant-btn\.tree-table-expand$/,
  });
});

test('Fix 1: child header weight, quiet text mix, unchanged hover and the mock inset', () => {
  render(<TreeTableContainer height={400} data-test="tree-table-styles" />);
  const styles = screen.getByTestId('tree-table-styles');
  expect(styles).toHaveStyleRule('font-weight', '600', {
    target: /\.tree-table-child-group \.ag-header-cell-text$/,
  });
  expect(styles).toHaveStyleRule(
    'color',
    expect.stringMatching(/^color-mix\(in srgb, .+ 44%, .+\)$/),
    { target: /\.tree-table-detail-label$/ },
  );
  const hover = /\.tree-table-expand:not\(:disabled\):hover$/;
  expect(styles).toHaveStyleRule(
    'border',
    expect.stringMatching(/^1px solid /),
    {
      target: hover,
    },
  );
  expect(styles).not.toHaveStyleRule('border-color', expect.anything(), {
    target: hover,
  });
  expect(styles).toHaveStyleRule('padding-block', '12px', {
    target: /\.tree-table-open-area\s*>\s*\.ant-flex$/,
  });
  expect(styles).toHaveStyleRule('padding-inline', '36px 16px', {
    target: /\.tree-table-open-area\s*>\s*\.ant-flex$/,
  });
  expect(styles).toHaveStyleRule('padding-inline', '44px 16px', {
    target: /\[role=['"]?group['"]?\]:not\(\.tree-table-child-group\)$/,
  });
});

test('child rows and open rows use the opaque secondary border token', () => {
  render(<TreeTableContainer height={400} data-test="tree-table-styles" />);
  const styles = screen.getByTestId('tree-table-styles');
  const opaque = expect.stringMatching(/^solid 1px (#[0-9a-f]{6}|rgb\()/i);
  expect(styles).toHaveStyleRule('--ag-row-border', opaque, {
    target: /\.tree-table-child-group \.ag-row:not\(\.ag-full-width-row\)$/,
  });
  expect(styles).toHaveStyleRule('--ag-row-border', opaque, {
    target: /\[aria-expanded=['"]?true['"]?\]\)$/,
  });
});

test('the expanded cell and child group expose their styling classes', () => {
  const { container } = renderRow(contextValue());
  expect(container.querySelector('.tree-table-open-area')).toHaveAttribute(
    'role',
    'gridcell',
  );
  expect(container.querySelector('.tree-table-child-group')).toHaveAttribute(
    'role',
    'group',
  );
});
