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
import FilterableTable from 'src/components/FilterableTable';
import { render, screen, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';

describe('FilterableTable', () => {
  const mockedProps = {
    orderedColumnKeys: ['a', 'b', 'c', 'children'],
    data: [
      { a: 'a1', b: 'b1', c: 'c1', d: 0, children: 0 },
      { a: 'a2', b: 'b2', c: 'c2', d: 100, children: 2 },
      { a: null, b: 'b3', c: 'c3', d: 50, children: 1 },
    ],
    height: 500,
  };
  it('is valid element', () => {
    expect(isValidElement(<FilterableTable {...mockedProps} />)).toBe(true);
  });
  it('renders a grid with 3 Table rows', () => {
    const { getByRole, getByText } = render(
      <FilterableTable {...mockedProps} />,
    );
    expect(getByRole('table')).toBeInTheDocument();
    mockedProps.data.forEach(({ b: columnBContent }) => {
      expect(getByText(columnBContent)).toBeInTheDocument();
    });
  });
  it('filters on a string', () => {
    const props = {
      ...mockedProps,
      filterText: 'b1',
    };
    const { getByText, queryByText } = render(<FilterableTable {...props} />);
    expect(getByText(props.filterText)).toBeInTheDocument();
    expect(queryByText('b2')).toBeFalsy();
    expect(queryByText('b3')).toBeFalsy();
  });
  it('filters on a number', () => {
    const props = {
      ...mockedProps,
      filterText: '100',
    };
    const { getByText, queryByText } = render(<FilterableTable {...props} />);
    expect(getByText('b2')).toBeInTheDocument();
    expect(queryByText('b1')).toBeFalsy();
    expect(queryByText('b3')).toBeFalsy();
  });
});

describe('FilterableTable sorting - RTL', () => {
  it('sorts strings correctly', () => {
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

    const stringColumn = within(screen.getByRole('table'))
      .getByText('columnA')
      .closest('th');
    // Antd 4.x Table does not follow the table role structure. Need a hacky selector to point the cell item
    const gridCells = screen.getByTitle('Bravo').closest('.virtual-grid');

    // Original order
    expect(gridCells?.textContent).toEqual(
      ['Bravo', 'Alpha', 'Charlie'].join(''),
    );

    if (stringColumn) {
      // First click to sort ascending
      userEvent.click(stringColumn);
    }

    expect(gridCells?.textContent).toEqual(
      ['Alpha', 'Bravo', 'Charlie'].join(''),
    );

    if (stringColumn) {
      // Second click to sort descending
      userEvent.click(stringColumn);
    }

    expect(gridCells?.textContent).toEqual(
      ['Charlie', 'Bravo', 'Alpha'].join(''),
    );

    if (stringColumn) {
      // Third click to clear sorting
      userEvent.click(stringColumn);
    }
    expect(gridCells?.textContent).toEqual(
      ['Bravo', 'Alpha', 'Charlie'].join(''),
    );
  });

  it('sorts integers correctly', () => {
    const integerProps = {
      orderedColumnKeys: ['columnB'],
      data: [{ columnB: 21 }, { columnB: 0 }, { columnB: 623 }],
      height: 500,
    };
    render(<FilterableTable {...integerProps} />);

    const integerColumn = within(screen.getByRole('table'))
      .getByText('columnB')
      .closest('th');
    const gridCells = screen.getByTitle('21').closest('.virtual-grid');

    // Original order
    expect(gridCells?.textContent).toEqual(['21', '0', '623'].join(''));

    // First click to sort ascending
    if (integerColumn) {
      userEvent.click(integerColumn);
    }
    expect(gridCells?.textContent).toEqual(['0', '21', '623'].join(''));

    // Second click to sort descending
    if (integerColumn) {
      userEvent.click(integerColumn);
    }
    expect(gridCells?.textContent).toEqual(['623', '21', '0'].join(''));

    // Third click to clear sorting
    if (integerColumn) {
      userEvent.click(integerColumn);
    }
    expect(gridCells?.textContent).toEqual(['21', '0', '623'].join(''));
  });

  it('sorts floating numbers correctly', () => {
    const floatProps = {
      orderedColumnKeys: ['columnC'],
      data: [{ columnC: 45.67 }, { columnC: 1.23 }, { columnC: 89.0000001 }],
      height: 500,
    };
    render(<FilterableTable {...floatProps} />);

    const floatColumn = within(screen.getByRole('table'))
      .getByText('columnC')
      .closest('th');
    const gridCells = screen.getByTitle('45.67').closest('.virtual-grid');

    // Original order
    expect(gridCells?.textContent).toEqual(
      ['45.67', '1.23', '89.0000001'].join(''),
    );

    // First click to sort ascending
    if (floatColumn) {
      userEvent.click(floatColumn);
    }
    expect(gridCells?.textContent).toEqual(
      ['1.23', '45.67', '89.0000001'].join(''),
    );

    // Second click to sort descending
    if (floatColumn) {
      userEvent.click(floatColumn);
    }
    expect(gridCells?.textContent).toEqual(
      ['89.0000001', '45.67', '1.23'].join(''),
    );

    // Third click to clear sorting
    if (floatColumn) {
      userEvent.click(floatColumn);
    }
    expect(gridCells?.textContent).toEqual(
      ['45.67', '1.23', '89.0000001'].join(''),
    );
  });

  it('sorts rows properly when floating numbers have mixed types', () => {
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

    const mixedFloatColumn = within(screen.getByRole('table'))
      .getByText('columnD')
      .closest('th');
    const gridCells = screen.getByTitle('48710.92').closest('.virtual-grid');

    // Original order
    expect(gridCells?.textContent).toEqual(
      [
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
      ].join(''),
    );
    // First click to sort ascending
    if (mixedFloatColumn) {
      userEvent.click(mixedFloatColumn);
    }
    expect(gridCells?.textContent).toEqual(
      [
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
      ].join(''),
    );

    // Second click to sort descending
    if (mixedFloatColumn) {
      userEvent.click(mixedFloatColumn);
    }
    expect(gridCells?.textContent).toEqual(
      [
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
      ].join(''),
    );

    // Third click to clear sorting
    if (mixedFloatColumn) {
      userEvent.click(mixedFloatColumn);
    }
    expect(gridCells?.textContent).toEqual(
      [
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
      ].join(''),
    );
  });

  it('sorts YYYY-MM-DD properly', () => {
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

    const dsColumn = within(screen.getByRole('table'))
      .getByText('columnDS')
      .closest('th');
    const gridCells = screen.getByTitle('2021-01-01').closest('.virtual-grid');

    // Original order
    expect(gridCells?.textContent).toEqual(
      [
        '2021-01-01',
        '2022-01-01',
        '2021-01-02',
        '2021-01-03',
        '2021-12-01',
        '2021-10-01',
        '2022-01-02',
      ].join(''),
    );

    // First click to sort ascending
    if (dsColumn) {
      userEvent.click(dsColumn);
    }
    expect(gridCells?.textContent).toEqual(
      [
        '2021-01-01',
        '2021-01-02',
        '2021-01-03',
        '2021-10-01',
        '2021-12-01',
        '2022-01-01',
        '2022-01-02',
      ].join(''),
    );

    // Second click to sort descending
    if (dsColumn) {
      userEvent.click(dsColumn);
    }
    expect(gridCells?.textContent).toEqual(
      [
        '2022-01-02',
        '2022-01-01',
        '2021-12-01',
        '2021-10-01',
        '2021-01-03',
        '2021-01-02',
        '2021-01-01',
      ].join(''),
    );

    // Third click to clear sorting
    if (dsColumn) {
      userEvent.click(dsColumn);
    }
    expect(gridCells?.textContent).toEqual(
      [
        '2021-01-01',
        '2022-01-01',
        '2021-01-02',
        '2021-01-03',
        '2021-12-01',
        '2021-10-01',
        '2022-01-02',
      ].join(''),
    );
  });
});
