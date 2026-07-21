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
import { render, waitFor } from '@superset-ui/core/spec';
import { TimeGranularity } from '@superset-ui/core';
import { ProviderWrapper } from '../../plugin-chart-table/test/testHelpers';
import testData from '../../plugin-chart-table/test/testData';

// Only the context-menu handler is exercised below; the mock below fakes
// its event argument rather than a real ag-grid CellContextMenuEvent, so
// it's typed loosely (unknown) rather than pinned to that library type.
interface CapturedGridProps {
  onCellContextMenu?: (event: Record<string, unknown>) => void;
}

// Capture the props the grid is rendered with, so we can invoke the
// onCellContextMenu handler directly without depending on AG Grid's DOM
// rendering or the (unregistered) Enterprise context-menu module.
const captured: { props?: CapturedGridProps } = {};

jest.mock('@superset-ui/core/components/ThemedAgGridReact', () => ({
  __esModule: true,
  ThemedAgGridReact: (props: CapturedGridProps) => {
    captured.props = props;
    return null;
  },
  AgGridReact: function AgGridReact() {
    return null;
  },
  AllCommunityModule: {},
  ClientSideRowModelModule: {},
  ModuleRegistry: { registerModules: () => undefined },
  setupAGGridModules: () => undefined,
  defaultModules: [],
  themeQuartz: {},
  colorSchemeDark: {},
  colorSchemeLight: {},
}));

// Imported after the mock is declared (jest.mock is hoisted above imports).
// eslint-disable-next-line import/first
import AgGridTableChart from '../src/AgGridTableChart';
// eslint-disable-next-line import/first
import transformProps from '../src/transformProps';

function renderChart(
  onContextMenu: jest.Mock,
  propsOverrides: Record<string, unknown> = {},
) {
  captured.props = undefined;
  const props = {
    ...transformProps({
      ...testData.basic,
      hooks: { ...testData.basic.hooks, onContextMenu },
      emitCrossFilters: true,
    }),
    ...propsOverrides,
  };
  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart {...props} setDataMask={jest.fn()} slice_id={1} />
      ),
    }),
  );
}

function makeColumn(colId: string, context: Record<string, unknown> = {}) {
  return {
    getColId: () => colId,
    getColDef: () => ({ context }),
  };
}

test('wires an onCellContextMenu handler when onContextMenu is provided', async () => {
  renderChart(jest.fn());
  await waitFor(() => expect(captured.props).toBeDefined());

  expect(typeof captured.props?.onCellContextMenu).toBe('function');
});

test('right-clicking a dimension cell emits drillToDetail, crossFilter and drillBy', async () => {
  const onContextMenu = jest.fn();
  renderChart(onContextMenu);
  await waitFor(() => expect(captured.props?.onCellContextMenu).toBeDefined());

  const preventDefault = jest.fn();
  const stopPropagation = jest.fn();
  const rowData = {
    __timestamp: null,
    name: 'Michael',
    sum__num: 2467063,
    'abc.com': 'foo',
  };

  captured.props?.onCellContextMenu?.({
    column: makeColumn('name'),
    data: rowData,
    value: 'Michael',
    event: {
      preventDefault,
      stopPropagation,
      clientX: 10,
      clientY: 20,
    },
  });

  expect(preventDefault).toHaveBeenCalled();
  expect(stopPropagation).toHaveBeenCalled();
  expect(onContextMenu).toHaveBeenCalledTimes(1);

  const [clientX, clientY, filters] = onContextMenu.mock.calls[0];
  expect(clientX).toBe(10);
  expect(clientY).toBe(20);

  // Non-temporal, non-null column → exact-match filter.
  expect(filters.drillToDetail).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ col: 'name', op: '==', val: 'Michael' }),
      expect.objectContaining({ col: 'abc.com', op: '==', val: 'foo' }),
    ]),
  );
  // Null column → IS NULL filter, not an exact match on null.
  expect(filters.drillToDetail).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ col: '__timestamp', op: 'IS NULL' }),
    ]),
  );

  expect(filters.crossFilter).toBeDefined();
  expect(filters.drillBy).toEqual({
    filters: [{ col: 'name', op: '==', val: 'Michael' }],
    groupbyFieldName: 'groupby',
  });
});

test('right-clicking a null cell emits an IS NULL drillBy filter with a null val', async () => {
  const onContextMenu = jest.fn();
  renderChart(onContextMenu);
  await waitFor(() => expect(captured.props?.onCellContextMenu).toBeDefined());

  captured.props?.onCellContextMenu?.({
    column: makeColumn('__timestamp'),
    data: { __timestamp: null, name: 'Michael', sum__num: 2467063 },
    value: null,
    event: {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      clientX: 0,
      clientY: 0,
    },
  });

  const [, , filters] = onContextMenu.mock.calls[0];
  // op and val must agree: IS NULL must carry a null val, not the clicked
  // cell's (possibly wrapped) value.
  expect(filters.drillBy).toEqual({
    filters: [{ col: '__timestamp', op: 'IS NULL', val: null }],
    groupbyFieldName: 'groupby',
  });
});

test('right-clicking a metric cell omits crossFilter and drillBy', async () => {
  const onContextMenu = jest.fn();
  renderChart(onContextMenu);
  await waitFor(() => expect(captured.props?.onCellContextMenu).toBeDefined());

  captured.props?.onCellContextMenu?.({
    column: makeColumn('sum__num', { isMetric: true }),
    data: { name: 'Michael', sum__num: 2467063 },
    value: 2467063,
    event: {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      clientX: 0,
      clientY: 0,
    },
  });

  const [, , filters] = onContextMenu.mock.calls[0];
  expect(filters.crossFilter).toBeUndefined();
  expect(filters.drillBy).toBeUndefined();
  // drillToDetail is still populated from the row's dimension columns.
  expect(filters.drillToDetail.length).toBeGreaterThan(0);
});

test('right-clicking a temporal cell with a time grain emits a TEMPORAL_RANGE filter', async () => {
  const onContextMenu = jest.fn();
  renderChart(onContextMenu, { timeGrain: TimeGranularity.DAY });
  await waitFor(() => expect(captured.props?.onCellContextMenu).toBeDefined());

  captured.props?.onCellContextMenu?.({
    column: makeColumn('name'),
    data: {
      __timestamp: '2020-01-01T12:34:56.000Z',
      name: 'Michael',
      sum__num: 2467063,
    },
    value: 'Michael',
    event: {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      clientX: 0,
      clientY: 0,
    },
  });

  const [, , filters] = onContextMenu.mock.calls[0];
  const timestampFilter = filters.drillToDetail.find(
    (f: { col: string }) => f.col === '__timestamp',
  );
  expect(timestampFilter.op).toBe('TEMPORAL_RANGE');
  // DAY granularity's range starts at the row's own timestamp (not
  // truncated to midnight) and ends at the start of the next UTC day.
  expect(timestampFilter.val).toBe(
    '2020-01-01T12:34:56.000Z : 2020-01-02T00:00:00.000Z',
  );
});

test('does not call onContextMenu in raw records mode', async () => {
  const onContextMenu = jest.fn();
  // isRawRecords is derived from query_mode inside transformProps; force it
  // here to isolate the handler's own guard from that derivation.
  renderChart(onContextMenu, { isRawRecords: true });
  await waitFor(() => expect(captured.props?.onCellContextMenu).toBeDefined());

  captured.props?.onCellContextMenu?.({
    column: makeColumn('name'),
    data: { name: 'Michael' },
    value: 'Michael',
    event: {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      clientX: 0,
      clientY: 0,
    },
  });

  expect(onContextMenu).not.toHaveBeenCalled();
});
