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
  Harness,
  data,
  focusToggleCell,
  level,
  openFirst,
  pageSizeSelect,
  props,
  routeSteps,
  stepsShown2,
  tick,
  twoLevels,
  userEvent,
} from '../../test/treeTableChartTestUtils';
import { render as renderWithProviders } from 'spec/helpers/testing-library';
import ChartRenderer, {
  ChartRendererProps,
} from 'src/components/Chart/ChartRenderer';
import { ChartSource } from 'src/types/ChartSource';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@superset-ui/core/spec';
import userEventLib from '@testing-library/user-event';
import { GenericDataType } from '@apache-superset/core/common';
import { addTranslation } from '@apache-superset/core/translation';
import {
  getChartMetadataRegistry,
  getChartComponentRegistry,
  FeatureFlag,
} from '@superset-ui/core';
import AgGridTableChartPlugin from '../index';
import { retainedTableControls } from '../../test/treeModeFixtures';
import TreeTableChart from './TreeTableChart';
import { TreeTableFormData } from './types';

test('Tree context menu does not reach the chart handler', async () => {
  const parent = jest.fn();
  render(
    <div onContextMenu={parent}>
      <TreeTableChart {...props()} />
    </div>,
  );
  fireEvent.contextMenu(await screen.findByRole('grid'));
  expect(parent).not.toHaveBeenCalled();
});

test('renderer ignores retained Table V2 controls during filter reconciliation', async () => {
  render(
    <TreeTableChart
      {...props({
        rawFormData: { ...props().rawFormData, ...retainedTableControls },
      })}
    />,
  );
  expect(await screen.findByRole('grid')).toBeInTheDocument();
  expect(screen.getAllByText('Voice').length).toBeGreaterThan(0);
});

test('clears stale chart state once per mount', () => {
  const onChartStateChange = jest.fn();
  const stale = props({
    ownState: {
      chartState: {
        serverPagination: true,
        pagination: { page: 3, pageSize: 100 },
      },
    },
    onChartStateChange,
  });
  const view = render(<TreeTableChart {...stale} />);
  expect(onChartStateChange).toHaveBeenCalledTimes(1);
  expect(onChartStateChange).toHaveBeenCalledWith({});
  view.rerender(<TreeTableChart {...stale} ownState={{ chartState: {} }} />);
  expect(onChartStateChange).toHaveBeenCalledTimes(1);
});

test('parent null values use the translated empty-cell label', async () => {
  addTranslation('N/A', ['Not available']);
  try {
    render(
      <TreeTableChart
        {...props({ data: [{ session_id: 'P1', channel: null }] })}
      />,
    );
    expect(await screen.findByText('Not available')).toBeInTheDocument();
  } finally {
    addTranslation('N/A', ['N/A']);
  }
});

test('a null parent ID displays N/A without an expand button', async () => {
  render(
    <TreeTableChart
      {...props({
        data: [{ session_id: null, channel: 'Voice' }],
        columns: [
          {
            key: 'session_id',
            label: 'Session',
            dataType: GenericDataType.String,
          },
        ],
      })}
    />,
  );
  const row = (await screen.findByText('N/A')).closest<HTMLElement>(
    '[role="row"]',
  )!;
  expect(row).toBeInTheDocument();
  expect(within(row).queryByRole('button', { name: /^Expand/ })).toBeNull();
});

test('literal dotted parent columns display and cross-filter their source value', async () => {
  const setDataMask = jest.fn();
  render(
    <TreeTableChart
      {...props({
        data: [{ session_id: 'P1', 'metric.value': 42, metric: { value: 99 } }],
        columns: [
          {
            key: 'metric.value',
            label: 'Metric',
            dataType: GenericDataType.Numeric,
          },
        ],
        emitCrossFilters: true,
        setDataMask,
      })}
    />,
  );
  const cell = await screen.findByText('42');
  await userEvent.click(cell);
  await waitFor(() =>
    expect(setDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        extraFormData: {
          filters: [{ col: 'metric.value', op: 'IN', val: [42] }],
        },
      }),
    ),
  );
});

test('a dataset marker-like field stays a real expandable parent row', async () => {
  render(
    <TreeTableChart
      {...props({
        data: [
          {
            session_id: 'P1',
            channel: 'Voice',
            __treeTableExpanded: true,
            detail: 'Parent detail',
          },
        ],
      })}
    />,
  );
  expect(await screen.findByText('P1')).toBeInTheDocument();
  await userEvent.click(
    await screen.findByRole('button', { name: /^Expand (?!all\b)/ }),
  );
  expect(await screen.findByText('Parent detail')).toBeInTheDocument();
  expect(screen.getByText('P1')).toBeInTheDocument();
});

const parentQueryChanges: {
  name: string;
  from?: Partial<TreeTableFormData>;
  to: Partial<TreeTableFormData>;
}[] = [
  { name: 'time range', to: { time_range: 'Last week' } },
  {
    name: 'cleared time range',
    from: { time_range: 'Last week' },
    to: { time_range: 'No filter' },
  },
  {
    name: 'dashboard date override',
    to: { extra_form_data: { time_range: 'Last week' } },
  },
  {
    name: 'dashboard column filter',
    to: {
      extra_form_data: {
        filters: [{ col: 'channel', op: 'IN', val: ['Voice'] }],
      },
    },
  },
  {
    name: 'chart filter',
    to: {
      adhoc_filters: [
        {
          clause: 'WHERE',
          expressionType: 'SIMPLE',
          subject: 'channel',
          operator: '==',
          comparator: 'Voice',
        },
      ],
    },
  },
];

test.each(parentQueryChanges)(
  '$name resets page 2 to the first page',
  ({ from, to }) => {
    const onMask = jest.fn();
    const value = props({ currentPage: 1, ownState: { currentPage: 1 } });
    const rawFormData = { ...value.rawFormData, ...from };
    const { rerender } = render(
      <Harness value={{ ...value, rawFormData }} onMask={onMask} />,
    );
    expect(screen.getByText('51 to 100 of 120')).toBeInTheDocument();
    rerender(
      <Harness
        value={{ ...value, rawFormData: { ...rawFormData, ...to } }}
        onMask={onMask}
      />,
    );
    expect(onMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({ currentPage: 0 }),
      }),
    );
    expect(screen.getByText('1 to 50 of 120')).toBeInTheDocument();
  },
);

test('a refresh with unchanged parent filters keeps page 2', () => {
  const onMask = jest.fn();
  const value = props({ currentPage: 1, ownState: { currentPage: 1 } });
  const { rerender } = render(<Harness value={value} onMask={onMask} />);
  rerender(
    <Harness
      value={{
        ...value,
        data: [...value.data],
        rawFormData: { ...value.rawFormData, force: true },
      }}
      onMask={onMask}
    />,
  );
  expect(onMask).not.toHaveBeenCalled();
  expect(screen.getByText('51 to 100 of 120')).toBeInTheDocument();
});

test('real grid headers, built-in sort and expansion survive data refresh only', async () => {
  const onMask = jest.fn();
  const value = props();
  const { container, rerender } = render(
    <Harness value={value} onMask={onMask} />,
  );
  await screen.findAllByText('Voice');
  expect(
    screen
      .getAllByRole('columnheader')
      .map(header => header.getAttribute('col-id')),
  ).toEqual(['tree_table_expand', 'session_id', 'channel']);
  expect(
    container.querySelectorAll(
      '.ag-header-cell-menu-button,.ag-header-cell-filter-button',
    ),
  ).toHaveLength(0);
  expect(
    screen.getAllByRole('button', { name: /^Expand (?!all\b)/ }),
  ).toHaveLength(3);
  await userEvent.click(
    screen.getAllByRole('button', { name: /^Expand (?!all\b)/ })[0],
  );
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: /^Collapse (?!all$)/ }),
    ).toHaveLength(2),
  );
  rerender(<Harness value={{ ...value, data: [...data] }} onMask={onMask} />);
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: /^Collapse (?!all$)/ }),
    ).toHaveLength(2),
  );
  const header = container.querySelector(
    '[role="columnheader"][col-id="channel"]',
  )!;
  await userEvent.click(header.querySelector('.ag-header-cell-label')!);
  await waitFor(() =>
    expect(onMask).toHaveBeenLastCalledWith({
      ownState: {
        currentPage: 0,
        sortBy: [{ id: 'channel', key: 'channel', desc: false }],
      },
    }),
  );
  expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(
    screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(header.querySelector('.ag-header-cell-label')!);
  await waitFor(() =>
    expect(header).toHaveAttribute('aria-sort', 'descending'),
  );
  await userEvent.click(header.querySelector('.ag-header-cell-label')!);
  await waitFor(() =>
    expect(onMask).toHaveBeenLastCalledWith({
      ownState: { currentPage: 0, sortBy: [] },
    }),
  );
  (header as HTMLElement).focus();
  fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' });
  await waitFor(() => expect(header).toHaveAttribute('aria-sort', 'ascending'));
  await tick();
  expect(onMask).toHaveBeenCalledTimes(4);
});

test.each([true, false])(
  'switching to the configured parent sort starts with its opposite (ascending: %s)',
  async ascending => {
    const onMask = jest.fn();
    const { container } = render(
      <Harness
        value={props({ levels: [{ ...level, sort: ['channel', ascending] }] })}
        onMask={onMask}
      />,
    );
    await screen.findAllByText('Voice');
    const header = container.querySelector(
      '[role="columnheader"][col-id="channel"]',
    )!;
    expect(header).toHaveAttribute(
      'aria-sort',
      ascending ? 'ascending' : 'descending',
    );
    expect(
      header.querySelector('.ag-sort-indicator-icon:not(.ag-hidden)'),
    ).toBeInTheDocument();
    await userEvent.click(
      container.querySelector(
        '[role="columnheader"][col-id="session_id"] .ag-header-cell-label',
      )!,
    );
    await waitFor(() =>
      expect(onMask).toHaveBeenLastCalledWith({
        ownState: {
          currentPage: 0,
          sortBy: [{ id: 'session_id', key: 'session_id', desc: false }],
        },
      }),
    );
    (header as HTMLElement).focus();
    fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(onMask).toHaveBeenCalledTimes(2));
    expect(onMask).toHaveBeenLastCalledWith({
      ownState: {
        currentPage: 0,
        sortBy: [{ id: 'channel', key: 'channel', desc: ascending }],
      },
    });
    expect(header).toHaveAttribute(
      'aria-sort',
      ascending ? 'descending' : 'ascending',
    );
    await userEvent.click(header.querySelector('.ag-header-cell-label')!);
    await waitFor(() => expect(onMask).toHaveBeenCalledTimes(3));
    expect(header).toHaveAttribute(
      'aria-sort',
      ascending ? 'ascending' : 'descending',
    );
    expect(onMask).toHaveBeenLastCalledWith({
      ownState: { currentPage: 0, sortBy: [] },
    });
  },
);

test.each([
  { ascending: true, savedDesc: true },
  { ascending: true, savedDesc: false },
  { ascending: false, savedDesc: false },
  { ascending: false, savedDesc: true },
])(
  'configured parent sort resumes a saved override (default ascending: $ascending, saved descending: $savedDesc)',
  async ({ ascending, savedDesc }) => {
    const onMask = jest.fn();
    const { container } = render(
      <Harness
        value={props({
          levels: [{ ...level, sort: ['channel', ascending] }],
          ownState: {
            sortBy: [{ id: 'channel', key: 'channel', desc: savedDesc }],
          },
        })}
        onMask={onMask}
      />,
    );
    await screen.findAllByText('Voice');
    const header = () =>
      container.querySelector('[role="columnheader"][col-id="channel"]')!;
    const savedIsOpposite = savedDesc === ascending;
    expect(header()).toHaveAttribute(
      'aria-sort',
      savedDesc ? 'descending' : 'ascending',
    );
    if (!savedIsOpposite) {
      await userEvent.click(header().querySelector('.ag-header-cell-label')!);
      await waitFor(() =>
        expect(onMask).toHaveBeenNthCalledWith(1, {
          ownState: {
            currentPage: 0,
            sortBy: [{ id: 'channel', key: 'channel', desc: ascending }],
          },
        }),
      );
    }
    await userEvent.click(header().querySelector('.ag-header-cell-label')!);
    await waitFor(() =>
      expect(onMask).toHaveBeenNthCalledWith(savedIsOpposite ? 1 : 2, {
        ownState: { currentPage: 0, sortBy: [] },
      }),
    );
    expect(header()).toHaveAttribute(
      'aria-sort',
      ascending ? 'ascending' : 'descending',
    );
  },
);

test('parent ID uses three clicks without a configured default sort', async () => {
  const onMask = jest.fn();
  const { container } = render(<Harness value={props()} onMask={onMask} />);
  await screen.findAllByText('Voice');
  const header = container.querySelector(
    '[role="columnheader"][col-id="session_id"]',
  )!;
  for (const [index, direction] of [
    'ascending',
    'descending',
    'ascending',
  ].entries()) {
    await userEvent.click(header.querySelector('.ag-header-cell-label')!);
    await waitFor(() => expect(onMask).toHaveBeenCalledTimes(index + 1));
    expect(header).toHaveAttribute('aria-sort', direction);
  }
  expect(onMask).toHaveBeenLastCalledWith({
    ownState: { currentPage: 0, sortBy: [] },
  });
});

test('Shift-click to the right replaces the previous sort', async () => {
  const user = userEventLib.setup({ advanceTimers: jest.advanceTimersByTime });
  const onMask = jest.fn();
  const { container } = render(<Harness value={props()} onMask={onMask} />);
  await screen.findAllByText('Voice');
  const label = (key: string) =>
    container.querySelector(
      `[role="columnheader"][col-id="${key}"] .ag-header-cell-label`,
    )!;
  await user.click(label('session_id'));
  await waitFor(() =>
    expect(onMask).toHaveBeenLastCalledWith({
      ownState: {
        currentPage: 0,
        sortBy: [{ id: 'session_id', key: 'session_id', desc: false }],
      },
    }),
  );
  await user.keyboard('{Shift>}');
  await user.click(label('channel'));
  await user.keyboard('{/Shift}');
  await waitFor(() =>
    expect(onMask).toHaveBeenLastCalledWith({
      ownState: {
        currentPage: 0,
        sortBy: [{ id: 'channel', key: 'channel', desc: false }],
      },
    }),
  );
});

test('expansion keeps keyboard focus on the same button across Enter and Space', async () => {
  render(<TreeTableChart {...props()} />);
  const [button] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  button.focus();
  await userEvent.type(button, '{enter}', { skipClick: true });
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
  expect(button).toHaveAccessibleName(/^Collapse (?!all$)/);
  expect(document.activeElement).toBe(button);
  await userEvent.type(button, ' ', { skipClick: true });
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
  expect(button).toHaveAccessibleName(/^Expand (?!all\b)/);
  expect(document.activeElement).toBe(button);
});

test.each(['ArrowLeft', 'Shift+Tab'])(
  'grid navigation with %s reaches expansion, focus goes into its button and stays through one toggle per key',
  async navigation => {
    const { container } = render(<TreeTableChart {...props()} />);
    const [button] = await screen.findAllByRole('button', {
      name: /^Expand (?!all\b)/,
    });
    const session = container.querySelector<HTMLElement>(
      '.ag-grid-scrolling-container > [row-index="0"] [col-id="session_id"]',
    )!;
    const expand = button.closest<HTMLElement>('[role="gridcell"]')!;
    session.focus();
    fireEvent.keyDown(session, {
      key: navigation === 'ArrowLeft' ? 'ArrowLeft' : 'Tab',
      shiftKey: navigation === 'Shift+Tab',
    });
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(expand).toHaveClass('ag-cell-focus');
    await userEvent.type(button, '{enter}', { skipClick: true });
    await waitFor(() =>
      expect(button).toHaveAttribute('aria-expanded', 'true'),
    );
    expect(button).toHaveAccessibleName(/^Collapse (?!all$)/);
    expect(document.activeElement).toBe(button);
    await userEvent.type(button, ' ', { skipClick: true });
    await waitFor(() =>
      expect(button).toHaveAttribute('aria-expanded', 'false'),
    );
    expect(button).toHaveAccessibleName(/^Expand (?!all\b)/);
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'Tab' });
    await waitFor(() => expect(document.activeElement).toBe(session));
  },
);

test.each([
  { row: 3, levels: [level] },
  { row: 4, levels: [level] },
  { row: 0, levels: [{ ...level, detail_fields: [] }] },
])(
  'keyboard activation ignores a blank expansion cell ($row, $levels)',
  async ({ row, levels }) => {
    const { container } = render(<TreeTableChart {...props({ levels })} />);
    await screen.findAllByText('Voice');
    const cell = container.querySelector<HTMLElement>(
      `.ag-grid-scrolling-container > [row-index="${row}"] [col-id="tree_table_expand"]`,
    )!;
    cell.focus();
    await userEvent.type(cell, '{enter} ', { skipClick: true });
    await tick();
    expect(cell.querySelector('button')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(cell);
  },
);

test('one level without detail fields has no expansion button', async () => {
  render(
    <TreeTableChart
      {...props({ levels: [{ ...level, detail_fields: [] }] })}
    />,
  );
  await screen.findAllByText('Chat');
  expect(
    screen.queryByRole('button', { name: /^Expand (?!all\b)/ }),
  ).not.toBeInTheDocument();
});

test('async cell clicks filter and toggle, while every expand-cell interaction preserves the active filter', async () => {
  const gridErrors = jest.spyOn(console, 'error');
  const onMask = jest.fn();
  const { container } = render(
    <Harness value={props({ emitCrossFilters: true })} onMask={onMask} />,
  );
  await waitFor(() =>
    expect(
      container.querySelector(
        '.ag-grid-scrolling-container > [row-index="0"] [col-id="channel"]',
      ),
    ).toBeInTheDocument(),
  );
  const cell = container.querySelector(
    '.ag-grid-scrolling-container > [row-index="0"] [col-id="channel"]',
  )!;
  await userEvent.click(cell);
  await waitFor(() =>
    expect(onMask).toHaveBeenCalledWith(
      expect.objectContaining({
        extraFormData: {
          filters: [{ col: 'channel', op: 'IN', val: ['Voice'] }],
        },
      }),
    ),
  );
  await waitFor(() => expect(cell).toHaveClass('dt-is-active-filter'));
  expect(gridErrors.mock.calls.flat().join(' ')).not.toContain(
    'AG Grid: error',
  );
  gridErrors.mockRestore();
  onMask.mockClear();
  const [button] = screen.getAllByRole('button', { name: /^Expand (?!all\b)/ });
  await userEvent.click(button);
  await userEvent.click(
    container.querySelector(
      '.ag-grid-scrolling-container > [row-index="3"] [col-id="tree_table_expand"]',
    )!,
  );
  button.focus();
  await userEvent.type(button, '{enter} ');
  await tick();
  expect(onMask).not.toHaveBeenCalled();
  expect(cell).toHaveClass('dt-is-active-filter');
  await userEvent.click(cell);
  await waitFor(() =>
    expect(onMask).toHaveBeenCalledWith(
      expect.objectContaining({ extraFormData: { filters: [] } }),
    ),
  );
});

test('Explore cell click does nothing after async cellClicked is dispatched', async () => {
  const value = props();
  const { container } = render(<TreeTableChart {...value} />);
  await waitFor(() =>
    expect(
      container.querySelector(
        '.ag-grid-scrolling-container > [row-index="0"] [col-id="channel"]',
      ),
    ).toBeInTheDocument(),
  );
  await userEvent.click(
    container.querySelector(
      '.ag-grid-scrolling-container > [row-index="0"] [col-id="channel"]',
    )!,
  );
  await tick();
  expect(value.setDataMask).not.toHaveBeenCalled();
});

test('old saved search settings render the complete data with no search controls', async () => {
  const legacy = {
    ...props(),
    includeSearch: true,
    ownState: {
      currentPage: 0,
      searchText: 'no-match',
      searchColumn: 'session_id',
    },
  };
  render(<TreeTableChart {...legacy} />);
  await screen.findAllByText('Chat');
  expect(screen.getAllByText('Voice').length).toBeGreaterThan(0);
  expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
  expect(screen.queryByText('Search by:')).not.toBeInTheDocument();
});

test('out-of-range correction and configured page length each settle after one update', async () => {
  const onMask = jest.fn();
  const value = props({
    currentPage: 3,
    rowcount: 120,
    ownState: { currentPage: 3 },
  });
  const { rerender } = render(<Harness value={value} onMask={onMask} />);
  await waitFor(() =>
    expect(onMask).toHaveBeenCalledWith({ ownState: { currentPage: 2 } }),
  );
  await tick();
  expect(onMask).toHaveBeenCalledTimes(1);
  rerender(
    <Harness value={{ ...value, serverPageLength: 100 }} onMask={onMask} />,
  );
  await waitFor(() =>
    expect(onMask).toHaveBeenLastCalledWith({
      ownState: { currentPage: 0, pageSize: 100 },
    }),
  );
  await tick();
  expect(onMask).toHaveBeenCalledTimes(2);
});

test('unsaved chart page-size popup is inside chart-id-0 and changing it resets page', async () => {
  const onMask = jest.fn();
  const { container } = render(<Harness value={props()} onMask={onMask} />);
  const select = pageSizeSelect();
  fireEvent.mouseDown(select);
  const option = await screen.findByTitle('100');
  expect(container.querySelector('#chart-id-0')).toContainElement(option);
  await userEvent.click(option);
  await waitFor(() =>
    expect(onMask).toHaveBeenCalledWith({
      ownState: { pageSize: 100, currentPage: 0 },
    }),
  );
});

test.each([{ levels: [] }, { levels: undefined }])(
  'Tree renders safely without a parent level (%j)',
  ({ levels }) => {
    const { container } = render(<TreeTableChart {...props({ levels })} />);
    expect(container).toBeEmptyDOMElement();
  },
);

test.each(['aggregate', 'raw', 'tree'])(
  'coordinator decision: empty Table V2 %s uses the real ChartRenderer/SuperChart path',
  async queryMode => {
    const plugin = new AgGridTableChartPlugin()
      .configure({ key: 'ag-grid-table' })
      .register();
    getChartComponentRegistry().registerValue(
      'ag-grid-table',
      await plugin.loadChart(),
    );
    const flags = window.featureFlags;
    window.featureFlags = {
      ...flags,
      [FeatureFlag.TableV2TreeModeEnabled]: false,
    };
    try {
      renderWithProviders(
        <ChartRenderer
          chartId={1}
          vizType="ag-grid-table"
          source={ChartSource.Explore}
          datasource={{} as ChartRendererProps['datasource']}
          chartStatus="success"
          width={800}
          height={400}
          actions={
            {
              chartRenderingSucceeded: jest.fn(),
              logEvent: jest.fn(),
            } as unknown as ChartRendererProps['actions']
          }
          formData={{
            datasource: '1__table',
            viz_type: 'ag-grid-table',
            query_mode: queryMode,
          }}
          queriesResponse={[{ data: [] }, { data: [{ rowcount: 0 }] }]}
        />,
      );
      expect(
        await screen.findByText(
          queryMode === 'tree'
            ? 'Tree mode is turned off'
            : 'No results were returned for this query',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    } finally {
      window.featureFlags = flags;
      getChartMetadataRegistry().remove('ag-grid-table');
    }
  },
);

test('SuperChart ignores saved search settings and keeps the grid and zero pager with no parents', async () => {
  const plugin = new AgGridTableChartPlugin()
    .configure({ key: 'ag-grid-table' })
    .register();
  getChartComponentRegistry().registerValue(
    'ag-grid-table',
    await plugin.loadChart(),
  );
  const flags = window.featureFlags;
  window.featureFlags = {
    ...flags,
    [FeatureFlag.TableV2TreeModeEnabled]: true,
  };
  try {
    renderWithProviders(
      <ChartRenderer
        chartId={1}
        vizType="ag-grid-table"
        source={ChartSource.Explore}
        datasource={{} as ChartRendererProps['datasource']}
        actions={
          {
            chartRenderingSucceeded: jest.fn(),
            logEvent: jest.fn(),
          } as unknown as ChartRendererProps['actions']
        }
        chartStatus="success"
        width={800}
        height={400}
        formData={{
          viz_type: 'ag-grid-table',
          query_mode: 'tree',
          datasource: '1__table',
          levels: [level],
          include_search: true,
        }}
        ownState={{ searchText: 'no-match', searchColumn: 'session_id' }}
        queriesResponse={[
          {
            data: [],
            colnames: ['session_id', 'channel'],
            coltypes: [GenericDataType.String, GenericDataType.String],
          },
          { data: [{ rowcount: 0 }] },
        ]}
      />,
    );
    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('No Rows To Show')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent === '0 to 0 of 0' && element.tagName === 'LI',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Search by:')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('no-match')).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Expand all' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('session_id').length).toBeGreaterThan(0);
    expect(screen.queryByText('No Results')).not.toBeInTheDocument();
  } finally {
    getChartMetadataRegistry().remove('ag-grid-table');
    window.featureFlags = flags;
  }
});

test('a held Enter (keydowns with repeat) on a focused +/- button toggles once', async () => {
  render(<TreeTableChart {...props()} />);
  const [button] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  await focusToggleCell(button);
  expect(document.activeElement).toBe(button);
  const repeat = fireEvent.keyDown(button, { key: 'Enter', repeat: true });
  expect(repeat).toBe(false);
  const first = fireEvent.keyDown(button, { key: 'Enter' });
  expect(first).toBe(true);
});

test('Enter on a page number of the new pager sends the page change once and closes open rows', async () => {
  routeSteps(2);
  const onMask = jest.fn();
  const { container } = render(
    <Harness
      value={twoLevels({ levels: [level, stepsShown2] })}
      onMask={onMask}
    />,
  );
  await openFirst();
  await screen.findAllByText('2 Steps');
  const page = screen.getByRole('button', { name: 'Page 2' });
  page.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(onMask).toHaveBeenCalledWith({ ownState: { currentPage: 1 } }),
  );
  expect(onMask).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole('button', { name: /^Collapse (?!all$)/ }),
  ).toBeNull();
  expect(
    container.querySelector('.ant-pagination-item-active'),
  ).toHaveAttribute('title', '2');
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Page 2' }),
  );
});
