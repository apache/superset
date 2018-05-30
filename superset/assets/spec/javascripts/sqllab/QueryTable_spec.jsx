import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Table } from 'reactable';

import { queries } from './fixtures';
import QueryTable from '../../../src/SqlLab/components/QueryTable';

describe('QueryTable', () => {
  const mockedProps = {
    queries,
  };
  it('is valid', () => {
    expect(React.isValidElement(<QueryTable />)).to.equal(true);
  });
  it('is valid with props', () => {
    expect(
      React.isValidElement(<QueryTable {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders a proper table', () => {
    const wrapper = shallow(<QueryTable {...mockedProps} />);
    expect(wrapper.find(Table)).to.have.length(1);
    expect(wrapper.find(Table).shallow().find('table')).to.have.length(1);
    expect(wrapper.find(Table).shallow().find('table').find('Tr')).to.have.length(2);
  });
});
