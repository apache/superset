import React from 'react';
import { mount } from 'enzyme';
import FilterableTable from '../../../../src/components/FilterableTable/FilterableTable';

describe('FilterableTable', () => {
  const mockedProps = {
    orderedColumnKeys: ['a', 'b', 'c'],
    data: [
      { a: 'a1', b: 'b1', c: 'c1', d: 0 },
      { a: 'a2', b: 'b2', c: 'c2', d: 100 },
    ],
    height: 500,
  };
  let wrapper;
  beforeEach(() => {
    wrapper = mount(<FilterableTable {...mockedProps} />);
  });
  it('is valid element', () => {
    expect(React.isValidElement(<FilterableTable {...mockedProps} />)).toBe(true);
  });
  it('renders a grid with 2 rows', () => {
    expect(wrapper.find('.ReactVirtualized__Grid')).toHaveLength(1);
    expect(wrapper.find('.ReactVirtualized__Table__row')).toHaveLength(2);
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
