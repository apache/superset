import React from 'react';
import QueryTable from '../../../javascripts/SqlLab/components/QueryTable';
import { queries } from './fixtures';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('QueryTable', () => {
  const mockedProps = {
    queries,
  };
  it('is valid', () => {
    expect(React.isValidElement(<QueryTable />)).to.equal(true);
  });
  it('is valid with props', () => {
    expect(
      React.isValidElement(<QueryTable {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders a proper table', () => {
    const wrapper = mount(<QueryTable {...mockedProps} />);
    expect(wrapper.find('table')).to.have.length(1);
    expect(wrapper.find('tr')).to.have.length(4);
  });
});
