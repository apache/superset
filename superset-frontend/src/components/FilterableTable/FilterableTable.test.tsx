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
import React from 'react';
import { ReactWrapper } from 'enzyme';
import { styledMount as mount } from 'spec/helpers/theming';
import FilterableTable, {
  MAX_COLUMNS_FOR_TABLE,
} from 'src/components/FilterableTable/FilterableTable';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';

describe('FilterableTable', () => {
  const mockedProps = {
    orderedColumnKeys: ['a', 'b', 'c'],
    data: [
      { a: 'a1', b: 'b1', c: 'c1', d: 0 },
      { a: 'a2', b: 'b2', c: 'c2', d: 100 },
      { a: null, b: 'b3', c: 'c3', d: 50 },
    ],
    height: 500,
  };
  let wrapper: ReactWrapper;
  beforeEach(() => {
    wrapper = mount(<FilterableTable {...mockedProps} />);
  });
  it('is valid element', () => {
    expect(React.isValidElement(<FilterableTable {...mockedProps} />)).toBe(
      true,
    );
  });
  it('renders a grid with 2 Table rows', () => {
    expect(wrapper.find('.ReactVirtualized__Grid')).toExist();
    expect(wrapper.find('.ReactVirtualized__Table__row')).toHaveLength(3);
  });
  it('renders a grid with 2 Grid rows for wide tables', () => {
    const wideTableColumns = MAX_COLUMNS_FOR_TABLE + 1;
    const wideTableMockedProps = {
      orderedColumnKeys: Array.from(
        Array(wideTableColumns),
        (_, x) => `col_${x}`,
      ),
      data: [
        {
          ...Array.from(Array(wideTableColumns)).map((val, x) => ({
            [`col_${x}`]: x,
          })),
        },
      ],
      height: 500,
    };
    const wideTableWrapper = mount(
      <FilterableTable {...wideTableMockedProps} />,
    );
    expect(wideTableWrapper.find('.ReactVirtualized__Grid')).toHaveLength(2);
  });
  it('filters on a string', () => {
    const props = {
      ...mockedProps,
      filterText: 'b1',
    };
    wrapper = mount(<FilterableTable {...props} />);
    expect(wrapper.find('.ReactVirtualized__Table__row')).toExist();
  });
  it('filters on a number', () => {
    const props = {
      ...mockedProps,
      filterText: '100',
    };
    wrapper = mount(<FilterableTable {...props} />);
    expect(wrapper.find('.ReactVirtualized__Table__row')).toExist();
  });
});

describe('FilterableTable sorting - RTL', () => {
  it('sorts strings correctly', () => {
    const stringProps = {
      orderedColumnKeys: ['a'],
      data: [{ a: 'Bravo' }, { a: 'Alpha' }, { a: 'Charlie' }],
      height: 500,
    };
    render(<FilterableTable {...stringProps} />);

    const stringColumn = screen.getByRole('columnheader', { name: 'a' });
    const gridCells = screen.getAllByRole('gridcell');

    // Original order
    expect(gridCells[0]).toHaveTextContent('Bravo');
    expect(gridCells[1]).toHaveTextContent('Alpha');
    expect(gridCells[2]).toHaveTextContent('Charlie');

    // First click to sort ascending
    userEvent.click(stringColumn);
    expect(gridCells[0]).toHaveTextContent('Alpha');
    expect(gridCells[1]).toHaveTextContent('Bravo');
    expect(gridCells[2]).toHaveTextContent('Charlie');

    // Second click to sort descending
    userEvent.click(stringColumn);
    expect(gridCells[0]).toHaveTextContent('Charlie');
    expect(gridCells[1]).toHaveTextContent('Bravo');
    expect(gridCells[2]).toHaveTextContent('Alpha');

    // Third click to sort ascending again
    userEvent.click(stringColumn);
    expect(gridCells[0]).toHaveTextContent('Alpha');
    expect(gridCells[1]).toHaveTextContent('Bravo');
    expect(gridCells[2]).toHaveTextContent('Charlie');
  });

  it('sorts integers correctly', () => {
    const integerProps = {
      orderedColumnKeys: ['b'],
      data: [{ b: 10 }, { b: 0 }, { b: 100 }],
      height: 500,
    };
    render(<FilterableTable {...integerProps} />);

    const integerColumn = screen.getByRole('columnheader', { name: 'b' });
    const gridCells = screen.getAllByRole('gridcell');

    // Original order
    expect(gridCells[0]).toHaveTextContent('10');
    expect(gridCells[1]).toHaveTextContent('0');
    expect(gridCells[2]).toHaveTextContent('100');

    // First click to sort ascending
    userEvent.click(integerColumn);
    expect(gridCells[0]).toHaveTextContent('0');
    expect(gridCells[1]).toHaveTextContent('10');
    expect(gridCells[2]).toHaveTextContent('100');

    // Second click to sort descending
    userEvent.click(integerColumn);
    expect(gridCells[0]).toHaveTextContent('100');
    expect(gridCells[1]).toHaveTextContent('10');
    expect(gridCells[2]).toHaveTextContent('0');

    // Third click to sort ascending again
    userEvent.click(integerColumn);
    expect(gridCells[0]).toHaveTextContent('0');
    expect(gridCells[1]).toHaveTextContent('10');
    expect(gridCells[2]).toHaveTextContent('100');
  });

  it('sorts floating numbers correctly', () => {
    const floatProps = {
      orderedColumnKeys: ['c'],
      data: [{ c: 45.67 }, { c: 1.23 }, { c: 89.0000001 }],
      height: 500,
    };
    render(<FilterableTable {...floatProps} />);

    const floatColumn = screen.getByRole('columnheader', { name: 'c' });
    const gridCells = screen.getAllByRole('gridcell');

    // Original order
    expect(gridCells[0]).toHaveTextContent('45.67');
    expect(gridCells[1]).toHaveTextContent('1.23');
    expect(gridCells[2]).toHaveTextContent('89.0000001');

    // First click to sort ascending
    userEvent.click(floatColumn);
    expect(gridCells[0]).toHaveTextContent('1.23');
    expect(gridCells[1]).toHaveTextContent('45.67');
    expect(gridCells[2]).toHaveTextContent('89.0000001');

    // Second click to sort descending
    userEvent.click(floatColumn);
    expect(gridCells[0]).toHaveTextContent('89.0000001');
    expect(gridCells[1]).toHaveTextContent('45.67');
    expect(gridCells[2]).toHaveTextContent('1.23');

    // Third click to sort ascending again
    userEvent.click(floatColumn);
    expect(gridCells[0]).toHaveTextContent('1.23');
    expect(gridCells[1]).toHaveTextContent('45.67');
    expect(gridCells[2]).toHaveTextContent('89.0000001');
  });

  it('sorts rows properly when floating numbers have mixed types', () => {
    const mixedFloatProps = {
      orderedColumnKeys: ['d'],
      data: [
        { d: 48710.92 },
        { d: 145776.56 },
        { d: 72212.86 },
        { d: '144729.96000000002' },
        { d: '26260.210000000003' },
        { d: '152718.97999999998' },
        { d: 28550.59 },
        { d: '24078.610000000004' },
        { d: '98089.08000000002' },
        { d: '3439718.0300000007' },
        { d: '4528047.219999993' },
      ],
      height: 500,
    };
    render(<FilterableTable {...mixedFloatProps} />);

    const mixedFloatColumn = screen.getByRole('columnheader', { name: 'd' });
    const gridCells = screen.getAllByRole('gridcell');

    // Original order
    expect(gridCells[0]).toHaveTextContent('48710.92');
    expect(gridCells[1]).toHaveTextContent('145776.56');
    expect(gridCells[2]).toHaveTextContent('72212.86');
    expect(gridCells[3]).toHaveTextContent('144729.96000000002');
    expect(gridCells[4]).toHaveTextContent('26260.210000000003');
    expect(gridCells[5]).toHaveTextContent('152718.97999999998');
    expect(gridCells[6]).toHaveTextContent('28550.59');
    expect(gridCells[7]).toHaveTextContent('24078.610000000004');
    expect(gridCells[8]).toHaveTextContent('98089.08000000002');
    expect(gridCells[9]).toHaveTextContent('3439718.0300000007');
    expect(gridCells[10]).toHaveTextContent('4528047.219999993');

    // First click to sort ascending
    userEvent.click(mixedFloatColumn);
    expect(gridCells[0]).toHaveTextContent('24078.610000000004');
    expect(gridCells[1]).toHaveTextContent('26260.210000000003');
    expect(gridCells[2]).toHaveTextContent('28550.59');
    expect(gridCells[3]).toHaveTextContent('48710.92');
    expect(gridCells[4]).toHaveTextContent('72212.86');
    expect(gridCells[5]).toHaveTextContent('98089.08000000002');
    expect(gridCells[6]).toHaveTextContent('144729.96000000002');
    expect(gridCells[7]).toHaveTextContent('145776.56');
    expect(gridCells[8]).toHaveTextContent('152718.97999999998');
    expect(gridCells[9]).toHaveTextContent('3439718.0300000007');
    expect(gridCells[10]).toHaveTextContent('4528047.219999993');

    // Second click to sort descending
    userEvent.click(mixedFloatColumn);
    expect(gridCells[0]).toHaveTextContent('4528047.219999993');
    expect(gridCells[1]).toHaveTextContent('3439718.0300000007');
    expect(gridCells[2]).toHaveTextContent('152718.97999999998');
    expect(gridCells[3]).toHaveTextContent('145776.56');
    expect(gridCells[4]).toHaveTextContent('144729.96000000002');
    expect(gridCells[5]).toHaveTextContent('98089.08000000002');
    expect(gridCells[6]).toHaveTextContent('72212.86');
    expect(gridCells[7]).toHaveTextContent('48710.92');
    expect(gridCells[8]).toHaveTextContent('28550.59');
    expect(gridCells[9]).toHaveTextContent('26260.210000000003');
    expect(gridCells[10]).toHaveTextContent('24078.610000000004');

    // Third click to sort ascending again
    userEvent.click(mixedFloatColumn);
    expect(gridCells[0]).toHaveTextContent('24078.610000000004');
    expect(gridCells[1]).toHaveTextContent('26260.210000000003');
    expect(gridCells[2]).toHaveTextContent('28550.59');
    expect(gridCells[3]).toHaveTextContent('48710.92');
    expect(gridCells[4]).toHaveTextContent('72212.86');
    expect(gridCells[5]).toHaveTextContent('98089.08000000002');
    expect(gridCells[6]).toHaveTextContent('144729.96000000002');
    expect(gridCells[7]).toHaveTextContent('145776.56');
    expect(gridCells[8]).toHaveTextContent('152718.97999999998');
    expect(gridCells[9]).toHaveTextContent('3439718.0300000007');
    expect(gridCells[10]).toHaveTextContent('4528047.219999993');
  });
});
