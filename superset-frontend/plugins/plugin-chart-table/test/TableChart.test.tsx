/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@superset-ui/core/spec';
import { cloneDeep } from 'lodash';
import { TimeGranularity } from '@superset-ui/core';
import TableChart, { sanitizeHeaderId } from '../src/TableChart';
import transformProps from '../src/transformProps';
import DateWithFormatter from '../src/utils/DateWithFormatter';
import testData from './testData';
import { ProviderWrapper } from './testHelpers';

// Mocking react-icons because local workspace linking is acting up
jest.mock(
  'react-icons/fa',
  () => ({
    FaSort: () => null,
    FaSortDown: () => null,
    FaSortUp: () => null,
  }),
  { virtual: true },
);

describe('sanitizeHeaderId', () => {
  test('sanitizes special characters correctly', () => {
    expect(sanitizeHeaderId('%pct_nice')).toBe('percentpct_nice');
    expect(sanitizeHeaderId('# metric_1')).toBe('hash_metric_1');
    expect(sanitizeHeaderId('△ delta')).toBe('delta_delta');
    expect(sanitizeHeaderId('multiple   spaces')).toBe('multiple_spaces');
    expect(sanitizeHeaderId('% #△ test')).toBe('percent_hashdelta_test');
    expect(sanitizeHeaderId('col@name!test')).toBe('col_name_test');
    expect(sanitizeHeaderId('col___name')).toBe('col_name');
  });

  test('trims leading and trailing underscores', () => {
    expect(sanitizeHeaderId('@col@')).toBe('col');
    expect(sanitizeHeaderId('!test!')).toBe('test');
    expect(sanitizeHeaderId('  spaced  ')).toBe('spaced');
  });
});

describe('plugin-chart-table', () => {
  describe('transformProps', () => {
    test('should parse pageLength to pageSize', () => {
      expect(transformProps(testData.basic).pageSize).toBe(20);
    });

    test('should format timestamp correctly', () => {
      const data = transformProps(testData.basic).data[0];
      const parsedDate = data.__timestamp as DateWithFormatter;
      expect(String(parsedDate)).toBe('2020-01-01 12:34:56');
    });

    test('should process comparison columns correctly', () => {
      const transformedProps = transformProps(testData.comparison);
      const comparisonColumns = transformedProps.columns.filter(col =>
        ['#', '△', '%', 'Main'].includes(col.label),
      );
      expect(comparisonColumns.length).toBeGreaterThan(0);
    });
  });

  describe('TableChart Rendering', () => {
    test('render basic data rows', () => {
      render(<TableChart {...transformProps(testData.basic)} sticky={false} />);
      const firstDataRow = screen.getAllByRole('rowgroup')[1];
      const cells = firstDataRow.querySelectorAll('td');
      expect(cells[0]).toHaveTextContent('2020-01-01 12:34:56');
      expect(cells[1]).toHaveTextContent('Michael');
    });

    test('render empty state', () => {
      render(<TableChart {...transformProps(testData.empty)} sticky={false} />);
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });

    test('recalculates totals when user filters data', async () => {
      const props = transformProps(testData.basic);
      props.totals = { sum__num: 1000 };
      props.includeSearch = true;
      render(
        <ProviderWrapper>
          <TableChart {...props} sticky={false} />
        </ProviderWrapper>,
      );

      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'Michael' } });

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });
  });
});

/**
 * DRILL-TO-DETAIL FIX VERIFICATION (#23847)
 */
describe('Drill-to-Detail Temporal Range Logic', () => {
  test('uses TEMPORAL_RANGE for monthly grain', () => {
    const onContextMenu = jest.fn();
    const props = transformProps({
      ...testData.basic,
      rawFormData: {
        ...testData.basic.rawFormData,
        time_grain_sqla: TimeGranularity.MONTH,
      },
      hooks: { onContextMenu, setDataMask: jest.fn() },
    });
    render(<TableChart {...props} sticky={false} />);

    const tbody = screen.getAllByRole('rowgroup')[1];
    fireEvent.contextMenu(tbody.querySelectorAll('td')[0]);

    const [, , { drillToDetail }] = onContextMenu.mock.calls[0];
    const filter = drillToDetail.find((f: any) => f.col === '__timestamp');
    expect(filter.op).toBe('TEMPORAL_RANGE');
    // Boundary: 2020-01-01 -> 2020-02-01
    expect(filter.val).toContain(
      '2020-01-01T12:34:56.000Z : 2020-02-01T00:00:00.000Z',
    );
  });

  test('correctly handles NULL values by emitting IS NULL instead of 1970 timestamp', () => {
    const onContextMenu = jest.fn();
    const nullData = cloneDeep(testData.basic);
    nullData.queriesData[0].data[0].__timestamp = null;

    const props = transformProps({
      ...nullData,
      rawFormData: {
        ...nullData.rawFormData,
        time_grain_sqla: TimeGranularity.MONTH,
      },
      hooks: { onAddFilter: jest.fn(), onContextMenu, setDataMask: jest.fn() },
    });
    render(<TableChart {...props} sticky={false} />);

    const tbody = screen.getAllByRole('rowgroup')[1];
    fireEvent.contextMenu(tbody.querySelectorAll('td')[0]);

    const [, , { drillToDetail }] = onContextMenu.mock.calls[0];
    const filter = drillToDetail.find((f: any) => f.col === '__timestamp');

    // THE CRITICAL FIX: Ensure op is IS NULL
    expect(filter.op).toBe('IS NULL');
    expect(filter.val).toBeNull();
  });

  test('uses exact match for non-temporal columns', () => {
    const onContextMenu = jest.fn();
    const props = transformProps({
      ...testData.basic,
      hooks: { onContextMenu, setDataMask: jest.fn() },
    });
    render(<TableChart {...props} sticky={false} />);

    const tbody = screen.getAllByRole('rowgroup')[1];
    fireEvent.contextMenu(tbody.querySelectorAll('td')[1]); // Click 'name' column

    const [, , { drillToDetail }] = onContextMenu.mock.calls[0];
    const nameFilter = drillToDetail.find((f: any) => f.col === 'name');
    expect(nameFilter.op).toBe('==');
    expect(nameFilter.val).toBe('Michael');
  });
});
