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
import { mount } from 'enzyme';
import FilterableTable, {
  MAX_COLUMNS_FOR_TABLE,
} from 'src/components/FilterableTable/FilterableTable';

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
  let wrapper;
  beforeEach(() => {
    wrapper = mount(<FilterableTable {...mockedProps} />);
  });
  it('is valid element', () => {
    expect(React.isValidElement(<FilterableTable {...mockedProps} />)).toBe(
      true,
    );
  });
  it('renders a grid with 2 Table rows', () => {
    expect(wrapper.find('.ReactVirtualized__Grid')).toHaveLength(1);
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
        Object.assign(
          ...Array.from(Array(wideTableColumns)).map((val, x) => ({
            [`col_${x}`]: x,
          })),
        ),
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
    expect(wrapper.find('.ReactVirtualized__Table__row')).toHaveLength(1);
  });
  it('filters on a number', () => {
    const props = {
      ...mockedProps,
      filterText: '100',
    };
    wrapper = mount(<FilterableTable {...props} />);
    expect(wrapper.find('.ReactVirtualized__Table__row')).toHaveLength(1);
  });
});
