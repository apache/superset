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
import { isValidElement } from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import { FilterableTable } from '.';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('FilterableTable', () => {
  beforeAll(() => {
    setupAGGridModules();
  });

  const mockedProps = {
    orderedColumnKeys: ['a', 'b', 'c', 'children'],
    data: [
      { a: 'a1', b: 'b1', c: 'c1', d: 0, children: 0 },
      { a: 'a2', b: 'b2', c: 'c2', d: 100, children: 2 },
      { a: null, b: 'b3', c: 'c3', d: 50, children: 1 },
    ],
    height: 500,
  };
  test('is valid element', () => {
    expect(isValidElement(<FilterableTable {...mockedProps} />)).toBe(true);
  });
  test('renders a grid with 3 Table rows', async () => {
    const { getByRole, findByText } = render(
      <FilterableTable {...mockedProps} />,
    );
    expect(getByRole('grid')).toBeInTheDocument();
    await Promise.all(
      mockedProps.data.map(async ({ b: columnBContent }) =>
        expect(await findByText(columnBContent)).toBeInTheDocument(),
      ),
    );
  });
  test('filters on a string', async () => {
    const props = {
      ...mockedProps,
      filterText: 'b1',
    };
    const { findByText, queryByText } = render(<FilterableTable {...props} />);
    expect(await findByText(props.filterText)).toBeInTheDocument();
    expect(queryByText('b2')).not.toBeInTheDocument();
    expect(queryByText('b3')).not.toBeInTheDocument();
  });
  test('filters on a number', async () => {
    const props = {
      ...mockedProps,
      filterText: '100',
    };
    const { findByText, queryByText } = render(<FilterableTable {...props} />);
    expect(await findByText('b2')).toBeInTheDocument();
    expect(queryByText('b1')).not.toBeInTheDocument();
    expect(queryByText('b3')).not.toBeInTheDocument();
  });

  test('shows all rows when filterText is empty', async () => {
    const props = {
      ...mockedProps,
      filterText: '',
    };
    const { findByText } = render(<FilterableTable {...props} />);
    expect(await findByText('b1')).toBeInTheDocument();
    expect(await findByText('b2')).toBeInTheDocument();
    expect(await findByText('b3')).toBeInTheDocument();
  });

  test('updates filtered rows when filterText prop changes', async () => {
    const props = {
      ...mockedProps,
      filterText: 'b1',
    };
    const { findByText, queryByText, rerender } = render(
      <FilterableTable {...props} />,
    );
    expect(await findByText('b1')).toBeInTheDocument();
    expect(queryByText('b2')).not.toBeInTheDocument();
    expect(queryByText('b3')).not.toBeInTheDocument();

    rerender(<FilterableTable {...mockedProps} filterText="b2" />);
    expect(await findByText('b2')).toBeInTheDocument();
    expect(queryByText('b1')).not.toBeInTheDocument();
    expect(queryByText('b3')).not.toBeInTheDocument();
  });

  test('shows all rows when filterText is cleared', async () => {
    const props = {
      ...mockedProps,
      filterText: 'b1',
    };
    const { findByText, queryByText, rerender } = render(
      <FilterableTable {...props} />,
    );
    expect(await findByText('b1')).toBeInTheDocument();
    expect(queryByText('b2')).not.toBeInTheDocument();

    rerender(<FilterableTable {...mockedProps} filterText="" />);
    expect(await findByText('b2')).toBeInTheDocument();
    expect(await findByText('b1')).toBeInTheDocument();
    expect(await findByText('b3')).toBeInTheDocument();
  });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('FilterableTable sorting - RTL', () => {
  beforeAll(() => {
    setupAGGridModules();
  });

  // AG Grid's row-number column shares the same `[role=rowgroup]` ancestor as
  // the data columns, so cell values for a single data column must be read by
  // targeting that column's `col-id` directly rather than a shared ancestor.
  const getColumnCellsText = (colId: string) =>
    Array.from(
      document.querySelectorAll(`[role="gridcell"][col-id="${colId}"]`),
    )
      .map(cell => cell.textContent)
      .join('');

  test('sorts strings correctly', async () => {
    const stringProps = {
      orderedColumnKeys: ['columnA'],
      data: [
        { columnA: 'Bravo' },
        { columnA: 'Alpha' },
        { columnA: 'Charlie' },
      ],
      height: 500,
    };
    render(<FilterableTable {...stringProps} />);

    const stringColumn = (
      await within(screen.getByRole('grid')).findByText('columnA')
    ).closest('[role=button]');

    // Original order
    await waitFor(() =>
      expect(getColumnCellsText('columnA')).toEqual(['Bravo', 'Alpha', 'Charlie'].join('')),
    );

    if (stringColumn) {
      // First click to sort ascending
      userEvent.click(stringColumn);
    }

    await waitFor(() =>
      expect(getColumnCellsText('columnA')).toEqual(['Alpha', 'Bravo', 'Charlie'].join('')),
    );

    if (stringColumn) {
      // Second click to sort descending
      userEvent.click(stringColumn);
    }

    await waitFor(() =>
      expect(getColumnCellsText('columnA')).toEqual(['Charlie', 'Bravo', 'Alpha'].join('')),
    );

    if (stringColumn) {
      // Third click to clear sorting
      userEvent.click(stringColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnA')).toEqual(['Bravo', 'Alpha', 'Charlie'].join('')),
    );
  });

  test('sorts integers correctly', async () => {
    const integerProps = {
      orderedColumnKeys: ['columnB'],
      data: [{ columnB: 21 }, { columnB: 0 }, { columnB: 623 }],
      height: 500,
    };
    render(<FilterableTable {...integerProps} />);

    const integerColumn = (
      await within(screen.getByRole('grid')).findByText('columnB')
    ).closest('[role=button]');

    // Original order
    await waitFor(() =>
      expect(getColumnCellsText('columnB')).toEqual(['21', '0', '623'].join('')),
    );

    // First click to sort ascending
    if (integerColumn) {
      userEvent.click(integerColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnB')).toEqual(['0', '21', '623'].join('')),
    );

    // Second click to sort descending
    if (integerColumn) {
      userEvent.click(integerColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnB')).toEqual(['623', '21', '0'].join('')),
    );

    // Third click to clear sorting
    if (integerColumn) {
      userEvent.click(integerColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnB')).toEqual(['21', '0', '623'].join('')),
    );
  });

  test('sorts floating numbers correctly', async () => {
    const floatProps = {
      orderedColumnKeys: ['columnC'],
      data: [{ columnC: 45.67 }, { columnC: 1.23 }, { columnC: 89.0000001 }],
      height: 500,
    };
    render(<FilterableTable {...floatProps} />);

    const floatColumn = (
      await within(screen.getByRole('grid')).findByText('columnC')
    ).closest('[role=button]');

    // Original order
    await waitFor(() =>
      expect(getColumnCellsText('columnC')).toEqual(['45.67', '1.23', '89.0000001'].join('')),
    );

    // First click to sort ascending
    if (floatColumn) {
      userEvent.click(floatColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnC')).toEqual(['1.23', '45.67', '89.0000001'].join('')),
    );

    // Second click to sort descending
    if (floatColumn) {
      userEvent.click(floatColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnC')).toEqual(['89.0000001', '45.67', '1.23'].join('')),
    );

    // Third click to clear sorting
    if (floatColumn) {
      userEvent.click(floatColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnC')).toEqual(['45.67', '1.23', '89.0000001'].join('')),
    );
  });

  test('sorts rows properly when floating numbers have mixed types', async () => {
    const mixedFloatProps = {
      orderedColumnKeys: ['columnD'],
      data: [
        { columnD: 48710.92 },
        { columnD: 145776.56 },
        { columnD: 72212.86 },
        { columnD: '144729.96000000002' },
        { columnD: '26260.210000000003' },
        { columnD: '152718.97999999998' },
        { columnD: 28550.59 },
        { columnD: '24078.610000000004' },
        { columnD: '98089.08000000002' },
        { columnD: '3439718.0300000007' },
        { columnD: '4528047.219999993' },
      ],
      height: 500,
    };
    render(<FilterableTable {...mixedFloatProps} />);

    const mixedFloatColumn = (
      await within(screen.getByRole('grid')).findByText('columnD')
    ).closest('[role=button]');

    // Original order
    await waitFor(() =>
      expect(getColumnCellsText('columnD')).toEqual([
        '48710.92',
        '145776.56',
        '72212.86',
        '144729.96000000002',
        '26260.210000000003',
        '152718.97999999998',
        '28550.59',
        '24078.610000000004',
        '98089.08000000002',
        '3439718.0300000007',
        '4528047.219999993',
      ].join('')),
    );
    // First click to sort ascending
    if (mixedFloatColumn) {
      userEvent.click(mixedFloatColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnD')).toEqual([
        '24078.610000000004',
        '26260.210000000003',
        '28550.59',
        '48710.92',
        '72212.86',
        '98089.08000000002',
        '144729.96000000002',
        '145776.56',
        '152718.97999999998',
        '3439718.0300000007',
        '4528047.219999993',
      ].join('')),
    );

    // Second click to sort descending
    if (mixedFloatColumn) {
      userEvent.click(mixedFloatColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnD')).toEqual([
        '4528047.219999993',
        '3439718.0300000007',
        '152718.97999999998',
        '145776.56',
        '144729.96000000002',
        '98089.08000000002',
        '72212.86',
        '48710.92',
        '28550.59',
        '26260.210000000003',
        '24078.610000000004',
      ].join('')),
    );

    // Third click to clear sorting
    if (mixedFloatColumn) {
      userEvent.click(mixedFloatColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnD')).toEqual([
        '48710.92',
        '145776.56',
        '72212.86',
        '144729.96000000002',
        '26260.210000000003',
        '152718.97999999998',
        '28550.59',
        '24078.610000000004',
        '98089.08000000002',
        '3439718.0300000007',
        '4528047.219999993',
      ].join('')),
    );
  });

  test('sorts YYYY-MM-DD properly', async () => {
    const dsProps = {
      orderedColumnKeys: ['columnDS'],
      data: [
        { columnDS: '2021-01-01' },
        { columnDS: '2022-01-01' },
        { columnDS: '2021-01-02' },
        { columnDS: '2021-01-03' },
        { columnDS: '2021-12-01' },
        { columnDS: '2021-10-01' },
        { columnDS: '2022-01-02' },
      ],
      height: 500,
    };
    render(<FilterableTable {...dsProps} />);

    const dsColumn = (
      await within(screen.getByRole('grid')).findByText('columnDS')
    ).closest('[role=button]');

    // Original order
    await waitFor(() =>
      expect(getColumnCellsText('columnDS')).toEqual([
        '2021-01-01',
        '2022-01-01',
        '2021-01-02',
        '2021-01-03',
        '2021-12-01',
        '2021-10-01',
        '2022-01-02',
      ].join('')),
    );

    // First click to sort ascending
    if (dsColumn) {
      userEvent.click(dsColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnDS')).toEqual([
        '2021-01-01',
        '2021-01-02',
        '2021-01-03',
        '2021-10-01',
        '2021-12-01',
        '2022-01-01',
        '2022-01-02',
      ].join('')),
    );

    // Second click to sort descending
    if (dsColumn) {
      userEvent.click(dsColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnDS')).toEqual([
        '2022-01-02',
        '2022-01-01',
        '2021-12-01',
        '2021-10-01',
        '2021-01-03',
        '2021-01-02',
        '2021-01-01',
      ].join('')),
    );

    // Third click to clear sorting
    if (dsColumn) {
      userEvent.click(dsColumn);
    }
    await waitFor(() =>
      expect(getColumnCellsText('columnDS')).toEqual([
        '2021-01-01',
        '2022-01-01',
        '2021-01-02',
        '2021-01-03',
        '2021-12-01',
        '2021-10-01',
        '2022-01-02',
      ].join('')),
    );
  });
});
