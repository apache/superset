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
import { render, screen } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import DateWithFormatter from '../src/utils/DateWithFormatter';
import testData from './testData';


const defaultTableProps = {
  sticky: false,
  show_split_buttons_in_slice_header: false,
  retain_selection_accross_navigation: false,
  enable_bulk_actions: false,
  include_row_numbers: false,
  bulk_action_id_column: 'id',
  selection_mode: 'multiple',
  enable_table_actions: false,
  table_actions_id_column: 'id',
  split_actions: new Set(),
  non_split_actions: new Set(),
  table_actions: new Set(),
  slice_id: 'test-slice',
};

// Helper for rendering TableChart consistently
const renderTableChart = (props: any) => {
  return render(
    <ThemeProvider theme={supersetTheme}>
      <TableChart
        {...transformProps(props)}
        {...defaultTableProps}
        {...props.overrideProps}
      />
    </ThemeProvider>
  );
};

describe('plugin-chart-table', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset window flag
    // @ts-ignore
    window.__tableChartResetDone = undefined;
  });

  describe('transformProps', () => {
    it('should parse pageLength to pageSize', () => {
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

    it('should memoize data records', () => {
      expect(transformProps(testData.basic).data).toBe(
        transformProps(testData.basic).data,
      );
    });

    it('should memoize columns meta', () => {
      expect(transformProps(testData.basic).columns).toBe(
        transformProps({
          ...testData.basic,
          rawFormData: { ...testData.basic.rawFormData, pageLength: null },
        }).columns,
      );
    });

    it('should format timestamp', () => {
      const parsedDate = transformProps(testData.basic).data[0]
        .__timestamp as DateWithFormatter;
      expect(String(parsedDate)).toBe('2020-01-01 12:34:56');
      expect(parsedDate.getTime()).toBe(1577882096000);
    });

    it('should process comparison columns when time_compare and comparison_type are set', () => {
      const transformedProps = transformProps(testData.comparison);
      const comparisonColumns = transformedProps.columns.filter(
        col =>
          col.label === 'Main' ||
          col.label === '#' ||
          col.label === '△' ||
          col.label === '%',
      );

      expect(comparisonColumns.length).toBeGreaterThan(0);
      expect(comparisonColumns.some(col => col.label === 'Main')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '#')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '△')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '%')).toBe(true);
    });

    it('should not process comparison columns when time_compare is empty', () => {
      const propsWithoutTimeCompare = {
        ...testData.comparison,
        rawFormData: {
          ...testData.comparison.rawFormData,
          time_compare: [],
        },
      };

      const transformedProps = transformProps(propsWithoutTimeCompare);
      const comparisonColumns = transformedProps.columns.filter(
        col =>
          col.label === 'Main' ||
          col.label === '#' ||
          col.label === '△' ||
          col.label === '%',
      );

      expect(comparisonColumns.length).toBe(0);
    });
  });

  describe('TableChart', () => {
    it('render basic data', () => {
      renderTableChart({ ...testData.basic });
      const firstDataRow = screen.getAllByRole('rowgroup')[1];
      const cells = firstDataRow.querySelectorAll('td');
      expect(cells).toHaveLength(12);
      expect(cells[0]).toHaveTextContent('2020-01-01 12:34:56');
      expect(cells[1]).toHaveTextContent('Michael');
      expect(cells[2]).toHaveTextContent('2467063');
      expect(cells[3]).toHaveTextContent('foo');
      expect(cells[6]).toHaveTextContent('2467');
      expect(cells[8]).toHaveTextContent('N/A');
    });

    it('render with bulk actions enabled', () => {
      renderTableChart({
        ...testData.basic,
        overrideProps: {
          enable_bulk_actions: true,
          split_actions: new Set(['approve', 'reject']),
          non_split_actions: new Set(['view']),
        },
      });

      // Check for checkbox column
      const selectionColumn = screen.getByRole('cell', { name: /selection/i });
      expect(selectionColumn).toBeInTheDocument();
      const checkbox = selectionColumn.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeInTheDocument();
    });

    it('render with row numbers enabled', () => {
      renderTableChart({
        ...testData.basic,
        overrideProps: {
          include_row_numbers: true,
        },
      });

      // Check row numbers
      const numberCells = screen.getAllByText(/^\d+$/);
      expect(numberCells.length).toBeGreaterThan(0);
    });

    it('render with single selection mode', () => {
      renderTableChart({
        ...testData.basic,
        overrideProps: {
          enable_bulk_actions: true,
          selection_mode: 'single',
        },
      });

      // Check for radio buttons
      const radioInputs = document.querySelectorAll('input[type="radio"]');
      expect(radioInputs.length).toBeGreaterThan(0);
    });

    it('render with table actions enabled', () => {
      renderTableChart({
        ...testData.basic,
        overrideProps: {
          enable_table_actions: true,
          table_actions: new Set(['edit', 'delete']),
        },
      });

      // Check for actions column
      const actionsHeader = screen.getByText('Actions');
      expect(actionsHeader).toBeInTheDocument();
    });

    it('render with split actions', () => {
      renderTableChart({
        ...testData.basic,
        overrideProps: {
          enable_bulk_actions: true,
          split_actions: new Set(['approve', 'reject']),
          non_split_actions: new Set(['view']),
          show_split_buttons_in_slice_header: true,
        },
      });

      // Check bulk action buttons
      const actionsContainer = screen.getByRole('group');
      expect(actionsContainer).toBeInTheDocument();
      expect(screen.getByText(/approve/i)).toBeInTheDocument();
      expect(screen.getByText(/reject/i)).toBeInTheDocument();
      expect(screen.getByText(/view/i)).toBeInTheDocument();
    });

    it('render advanced data', () => {
      renderTableChart({ ...testData.advanced });
      const secondColumnHeader = screen.getByText('Sum of Num');
      expect(secondColumnHeader).toBeInTheDocument();
      expect(secondColumnHeader?.getAttribute('data-column-name')).toEqual('1');

      const firstDataRow = screen.getAllByRole('rowgroup')[1];
      const cells = firstDataRow.querySelectorAll('td');
      expect(cells[0]).toHaveTextContent('Michael');
      expect(cells[2]).toHaveTextContent('12.346%');
      expect(cells[4]).toHaveTextContent('2.47k');
    });

    it('render cell bars properly', () => {
      const props = transformProps({
        ...testData.raw,
        rawFormData: { ...testData.raw.rawFormData },
      });

      props.columns[0].isMetric = true;

      renderTableChart({
        ...testData.raw,
        overrideProps: {
          ...props,
        },
      });

      const cellBars = document.querySelectorAll('div.cell-bar');
      cellBars.forEach(cell => {
        expect(cell).toHaveClass('positive');
      });
    });

    it('render without cell bars when disabled', () => {
      const props = transformProps({
        ...testData.raw,
        rawFormData: { ...testData.raw.rawFormData },
      });

      props.showCellBars = false;

      renderTableChart({
        ...testData.raw,
        overrideProps: {
          ...props,
        },
      });

      const cellBars = document.querySelectorAll('div.cell-bar');
      expect(cellBars.length).toBe(0);
    });

    it('retains selection across navigation when enabled', () => {
      // Setup initial selection
      localStorage.setItem('selectedRows_test-slice', JSON.stringify(['row1', 'row2']));

      renderTableChart({
        ...testData.basic,
        overrideProps: {
          enable_bulk_actions: true,
          retain_selection_accross_navigation: true,
        },
      });

      // Selection should be restored
      const selectedRows = JSON.parse(localStorage.getItem('selectedRows_test-slice') || '[]');
      expect(selectedRows).toContain('row1');
      expect(selectedRows).toContain('row2');
    });

    it('resets selection when retention is disabled', () => {
      // Setup initial selection
      localStorage.setItem('selectedRows_test-slice', JSON.stringify(['row1', 'row2']));

      renderTableChart({
        ...testData.basic,
        overrideProps: {
          enable_bulk_actions: true,
          retain_selection_accross_navigation: false,
        },
      });

      // Selection should be cleared
      const selectedRows = JSON.parse(localStorage.getItem('selectedRows_test-slice') || '[]');
      expect(selectedRows.length).toBe(0);
    });
  });
});
