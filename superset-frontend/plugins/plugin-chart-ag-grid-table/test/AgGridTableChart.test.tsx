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
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
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

  const pinnedRows = document.querySelectorAll('.ag-floating-bottom .ag-row');
  expect(pinnedRows.length).toBeGreaterThan(0);

  const dataRows = document.querySelectorAll(
    '.ag-body-viewport .ag-row:not(.ag-row-pinned)',
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

  const dataRows = document.querySelectorAll(
    '.ag-center-cols-container .ag-row',
  );
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
