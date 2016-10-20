import React from 'react';
import QueryTable from '../../../javascripts/SqlLab/components/QueryTable';
import { queries } from './common';
import { Button } from 'react-bootstrap';
import { mount, shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('QueryTable', () => {

  const mockedProps = {
    queries: queries,
  }
  it('should just render', () => {
    expect(React.isValidElement(<QueryTable />)).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<QueryTable {...mockedProps} />)
    ).to.equal(true);
  });
  it('has a table that looks right', () => {
    const wrapper = mount(<QueryTable {...mockedProps} />);
    expect(wrapper.find('table')).to.have.length(1);
    expect(wrapper.find('tr')).to.have.length(3);
  });
});
