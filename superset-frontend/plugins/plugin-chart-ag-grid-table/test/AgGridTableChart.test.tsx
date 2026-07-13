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
import { render, screen, waitFor } from '@superset-ui/core/spec';
import { QueryMode, TimeGranularity, SMART_DATE_ID } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  setupAGGridModules,
  type ColumnState,
} from '@superset-ui/core/components/ThemedAgGridReact';
import AgGridTableChart from '../src/AgGridTableChart';
import transformProps from '../src/transformProps';
import { ProviderWrapper } from '../../plugin-chart-table/test/testHelpers';
import testData from '../../plugin-chart-table/test/testData';

const mockSetDataMask = jest.fn();

beforeAll(() => {
  setupAGGridModules();
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('transformProps parses pageLength to pageSize', () => {
  expect(transformProps(testData.basic).pageSize).toBe(20);
  expect(
    transformProps({
      ...testData.basic,
      rawFormData: { ...testData.basic.rawFormData, page_length: '20' },
    }).pageSize,
  ).toBe(20);
  expect(
    transformProps({
      ...testData.basic,
      rawFormData: { ...testData.basic.rawFormData, page_length: '' },
    }).pageSize,
  ).toBe(0);
});

test('transformProps does not apply time grain formatting in Raw Records mode', () => {
  const rawRecordsProps = {
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      query_mode: QueryMode.Raw,
      time_grain_sqla: TimeGranularity.MONTH,
      table_timestamp_format: SMART_DATE_ID,
    },
  };

  const transformedProps = transformProps(rawRecordsProps);
  expect(transformedProps.isRawRecords).toBe(true);
  expect(transformedProps.timeGrain).toBe(TimeGranularity.MONTH);
});

test('transformProps handles null/undefined timestamp values correctly', () => {
  const rawRecordsProps = {
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      query_mode: QueryMode.Raw,
    },
  };

  const transformedProps = transformProps(rawRecordsProps);
  expect(transformedProps.isRawRecords).toBe(true);
});

test('AgGridTableChart renders basic data', async () => {
  const props = transformProps(testData.basic);
  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    const grid = document.querySelector('.ag-container');
    expect(grid).toBeInTheDocument();
  });

  const headerCells = document.querySelectorAll('.ag-header-cell-text');
  const headerTexts = Array.from(headerCells).map(el => el.textContent);
  expect(headerTexts).toContain('name');
  expect(headerTexts).toContain('sum__num');

  const dataRows = document.querySelectorAll('.ag-row:not(.ag-row-pinned)');
  expect(dataRows.length).toBe(3);

  expect(screen.getByText('Michael')).toBeInTheDocument();
  expect(screen.getByText('Joe')).toBeInTheDocument();
  expect(screen.getByText('Maria')).toBeInTheDocument();
});

test('AgGridTableChart renders with server pagination', async () => {
  const props = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      server_pagination: true,
    },
  });
  props.serverPagination = true;
  props.rowCount = 100;
  props.serverPaginationData = {
    currentPage: 0,
    pageSize: 20,
  };

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    const grid = document.querySelector('.ag-container');
    expect(grid).toBeInTheDocument();
  });

  expect(screen.getByText('Page Size:')).toBeInTheDocument();
  expect(screen.getByText('Page')).toBeInTheDocument();

  const paginationEl = screen.getByText('Page Size:').closest('div')!;
  const paginationText = paginationEl.textContent;
  expect(paginationText).toContain('1');
  expect(paginationText).toContain('20');
  expect(paginationText).toContain('100');
  expect(paginationText).toContain('5');
});

test('AgGridTableChart renders with search enabled', async () => {
  const props = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      include_search: true,
    },
  });
  props.includeSearch = true;

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    const grid = document.querySelector('.ag-container');
    expect(grid).toBeInTheDocument();
  });

  const searchContainer = document.querySelector('.search-container');
  expect(searchContainer).toBeInTheDocument();

  const searchInput = screen.getByPlaceholderText('Search');
  expect(searchInput).toBeInTheDocument();
  expect(searchInput).toHaveAttribute('type', 'text');
  expect(searchInput).toHaveAttribute('id', 'filter-text-box');
});

test('AgGridTableChart renders with totals', async () => {
  const props = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      show_totals: true,
    },
  });
  props.showTotals = true;
  props.totals = { sum__num: 1000 };

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    const grid = document.querySelector('.ag-container');
    expect(grid).toBeInTheDocument();
  });

  const pinnedRows = document.querySelectorAll(
    '.ag-grid-pinned-bottom-rows .ag-row',
  );
  expect(pinnedRows.length).toBeGreaterThan(0);

  const dataRows = document.querySelectorAll(
    '.ag-grid-viewport .ag-row:not(.ag-row-pinned)',
  );
  expect(dataRows.length).toBe(3);
});

test('AgGridTableChart handles empty data', async () => {
  const props = transformProps(testData.empty);

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    const grid = document.querySelector('.ag-container');
    expect(grid).toBeInTheDocument();
  });

  const dataRows = document.querySelectorAll('.ag-grid-viewport .ag-row');
  expect(dataRows.length).toBe(0);

  const headerCells = document.querySelectorAll('.ag-header-cell');
  expect(headerCells.length).toBeGreaterThan(0);
});

test('AgGridTableChart renders with time comparison', async () => {
  const props = transformProps(testData.comparison);
  props.isUsingTimeComparison = true;

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    const grid = document.querySelector('.ag-container');
    expect(grid).toBeInTheDocument();
  });

  const comparisonDropdown = document.querySelector(
    '.time-comparison-dropdown',
  );
  expect(comparisonDropdown).toBeInTheDocument();

  const headerCells = document.querySelectorAll('.ag-header-cell-text');
  const headerTexts = Array.from(headerCells).map(el => el.textContent);
  expect(headerTexts).toContain('#');
  expect(headerTexts).toContain('△');
  expect(headerTexts).toContain('%');
});

test('AgGridTableChart handles raw records mode', async () => {
  const rawRecordsProps = {
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      query_mode: QueryMode.Raw,
    },
  };
  const props = transformProps(rawRecordsProps);

  expect(props.isRawRecords).toBe(true);

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    const grid = document.querySelector('.ag-container');
    expect(grid).toBeInTheDocument();
  });

  const dataRows = document.querySelectorAll('.ag-row:not(.ag-row-pinned)');
  expect(dataRows.length).toBe(3);

  const headerCells = document.querySelectorAll('.ag-header-cell');
  expect(headerCells.length).toBeGreaterThan(0);
});

const rawSummaryProps = {
  ...testData.basic,
  rawFormData: {
    ...testData.basic.rawFormData,
    query_mode: QueryMode.Raw,
    show_totals: true,
  },
  datasource: {
    ...testData.basic.datasource,
    columns: [{ column_name: 'name' }, { column_name: 'sum__num' }],
  },
  queriesData: [
    {
      ...testData.basic.queriesData[0],
      colnames: [...testData.basic.queriesData[0].colnames, 'num_free'],
      coltypes: [
        ...testData.basic.queriesData[0].coltypes,
        GenericDataType.Numeric,
      ],
      data: testData.basic.queriesData[0].data,
    },
    { ...testData.basic.queriesData[0], data: [{ sum__num: 12345 }] },
  ],
};

test('transformProps derives numeric dataset columns as rawSummaryColumns in raw mode', () => {
  const transformed = transformProps(rawSummaryProps);
  // 'sum__num' is the only numeric column of the selection that is both
  // numeric and backed by a dataset column: 'num_free' is Numeric but not
  // dataset-backed, and 'name' is dataset-backed but not numeric.
  expect(transformed.rawSummaryColumns).toEqual(['sum__num']);
});

test('transformProps surfaces raw records totals when the summary is on', () => {
  const transformed = transformProps(rawSummaryProps);
  expect(transformed.totals).toEqual({ sum__num: 12345 });
});

test('transformProps leaves totals undefined in raw mode when the summary is off', () => {
  const transformed = transformProps({
    ...rawSummaryProps,
    rawFormData: {
      ...rawSummaryProps.rawFormData,
      show_totals: false,
    },
  });
  expect(transformed.totals).toBeUndefined();
  expect(transformed.rawSummaryColumns).toEqual([]);
});

test('transformProps returns empty rawSummaryColumns in aggregate mode', () => {
  const transformed = transformProps(testData.basic);
  expect(transformed.rawSummaryColumns).toEqual([]);
});

test('AgGridTableChart corrects invalid page number when currentPage >= totalPages', async () => {
  const props = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      server_pagination: true,
    },
  });
  props.serverPagination = true;
  props.rowCount = 50;
  props.serverPaginationData = {
    currentPage: 5,
    pageSize: 20,
  };

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(mockSetDataMask).toHaveBeenCalled();
  });
});

test('AgGridTableChart primes raw summary columns into own state', async () => {
  const props = transformProps(rawSummaryProps);

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(mockSetDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({
          rawSummaryColumns: ['sum__num'],
        }),
      }),
    );
  });
});

test('AgGridTableChart does not prime summary columns when the summary is off', async () => {
  const props = transformProps({
    ...rawSummaryProps,
    rawFormData: {
      ...rawSummaryProps.rawFormData,
      show_totals: false,
    },
  });

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(document.querySelector('.ag-container')).toBeInTheDocument();
  });
  const primedCalls = mockSetDataMask.mock.calls.filter(
    ([arg]) => arg?.ownState?.rawSummaryColumns,
  );
  expect(primedCalls).toHaveLength(0);
});

test('AgGridTableChart clears a stale summary prime when no numeric columns remain', async () => {
  const props = transformProps({
    ...rawSummaryProps,
    datasource: {
      ...testData.basic.datasource,
      columns: [{ column_name: 'name' }],
    },
  });
  props.serverPaginationData = { rawSummaryColumns: ['sum__num'] };

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(mockSetDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({ rawSummaryColumns: [] }),
      }),
    );
  });
});

test('AgGridTableChart requests aggregate totals when the summary toggles on without data', async () => {
  const props = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      show_totals: true,
    },
  });

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(mockSetDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({ totalsRequested: true }),
      }),
    );
  });
});

test('AgGridTableChart clears the aggregate totals request when the summary is off', async () => {
  const props = transformProps(testData.basic);
  props.serverPaginationData = { totalsRequested: true };

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(mockSetDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({
          totalsRequested: false,
        }),
      }),
    );
  });
});

test('AgGridTableChart clamps the page to zero when the result set is empty', async () => {
  const props = transformProps({
    ...rawSummaryProps,
    queriesData: [rawSummaryProps.queriesData[0]],
  });
  props.serverPagination = true;
  props.rowCount = 0;
  props.serverPaginationData = { currentPage: 5, pageSize: 20 };

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  // Zero rows means zero pages; a stale page index must reset so row_offset
  // does not keep pointing past the (now empty) result set. Asserting the
  // totals keys alongside pins the write to the unified effect rather than
  // the pagination footer's own page reset.
  await waitFor(() => {
    expect(mockSetDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({
          currentPage: 0,
          rawSummaryColumns: ['sum__num'],
          totalsRequested: true,
        }),
      }),
    );
  });
});

test('AgGridTableChart merges the page clamp and totals request into one own-state write', async () => {
  const props = transformProps({
    ...rawSummaryProps,
    queriesData: [rawSummaryProps.queriesData[0]],
  });
  props.serverPagination = true;
  props.rowCount = 41;
  props.serverPaginationData = { currentPage: 5, pageSize: 20 };

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  // 41 rows at page size 20 leave 3 pages, so page 5 must clamp to 2 in the
  // same write that primes the summary columns and requests totals; separate
  // writes would overwrite each other's keys.
  await waitFor(() => {
    expect(mockSetDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({
          currentPage: 2,
          rawSummaryColumns: ['sum__num'],
          totalsRequested: true,
        }),
      }),
    );
  });
});

test('AgGridTableChart re-requests raw totals when toggled back on with a matching prime', async () => {
  const props = transformProps({
    ...rawSummaryProps,
    queriesData: [rawSummaryProps.queriesData[0]],
  });

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
          serverPaginationData={{ rawSummaryColumns: ['sum__num'] }}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(mockSetDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({
          rawSummaryColumns: ['sum__num'],
          totalsRequested: true,
        }),
      }),
    );
  });
});

test('AgGridTableChart pins no summary row when totals come back empty', async () => {
  const props = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      show_totals: true,
    },
  });
  props.showTotals = true;
  // An empty totals object (e.g. a time-comparison totals result with no
  // rows) carries nothing to display and must not pin a blank row.
  props.totals = {};

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(document.querySelector('.ag-container')).toBeInTheDocument();
  });

  const pinnedRows = document.querySelectorAll(
    '.ag-grid-pinned-bottom-rows .ag-row',
  );
  expect(pinnedRows.length).toBe(0);
});

test('AgGridTableChart pins no summary row when totals are absent', async () => {
  const props = transformProps({
    ...rawSummaryProps,
    datasource: {
      ...testData.basic.datasource,
      columns: [{ column_name: 'name' }],
    },
    queriesData: [rawSummaryProps.queriesData[0]],
  });

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(document.querySelector('.ag-container')).toBeInTheDocument();
  });

  const pinnedRows = document.querySelectorAll(
    '.ag-grid-pinned-bottom-rows .ag-row',
  );
  expect(pinnedRows.length).toBe(0);
});

test('AgGridTableChart emits column state with aggFunc through the debounced save path', async () => {
  const props = transformProps(testData.basic);
  const onChartStateChange = jest.fn();

  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...props}
          setDataMask={mockSetDataMask}
          slice_id={1}
          onChartStateChange={onChartStateChange}
          chartState={{
            columnState: [{ colId: 'sum__num', aggFunc: null }],
            sortModel: [],
            filterModel: {},
          }}
        />
      ),
    }),
  );

  await waitFor(() => {
    expect(document.querySelector('.ag-container')).toBeInTheDocument();
  });

  // The save path is debounced (SLOW_DEBOUNCE = 500ms); wait for a capture.
  await waitFor(() => expect(onChartStateChange).toHaveBeenCalled(), {
    timeout: 3000,
  });

  const savedState =
    onChartStateChange.mock.calls[onChartStateChange.mock.calls.length - 1][0];
  const savedColumn = (savedState.columnState as ColumnState[]).find(
    col => col.colId === 'sum__num',
  );

  // Entries must carry an aggFunc key so "None" survives reload. The value
  // itself is not assertable here: aggregation state needs an enterprise
  // (SharedAggregation) module; the community modules always report null.
  expect(savedColumn).toMatchObject({ aggFunc: null });
});
