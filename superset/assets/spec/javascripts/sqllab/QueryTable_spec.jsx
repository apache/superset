import React from 'react';
import { shallow } from 'enzyme';
import { Table } from 'reactable';

import { queries } from './fixtures';
import QueryTable from '../../../src/SqlLab/components/QueryTable';

describe('QueryTable', () => {
  const mockedProps = {
    queries,
  };
  it('is valid', () => {
    expect(React.isValidElement(<QueryTable />)).toBe(true);
  });
  it('is valid with props', () => {
    expect(
      React.isValidElement(<QueryTable {...mockedProps} />),
    ).toBe(true);
  });
  it('renders a proper table', () => {
    const wrapper = shallow(<QueryTable {...mockedProps} />);
    expect(wrapper.find(Table)).toHaveLength(1);
    expect(wrapper.find(Table).shallow().find('table')).toHaveLength(1);
    expect(wrapper.find(Table).shallow().find('table').find('Tr')).toHaveLength(2);
  });
});
