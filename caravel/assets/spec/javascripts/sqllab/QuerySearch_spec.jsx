import React from 'react';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import QuerySearch from '../../../javascripts/SqlLab/components/QuerySearch';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('QuerySearch', () => {
  it('should render', () => {
    expect(
      React.isValidElement(<QuerySearch />)
    ).to.equal(true);
  });

  it('should have two Select', () => {
    const wrapper = shallow(<QuerySearch />);
    expect(wrapper.find(Select)).to.have.length(2);
  });

  it('should have one input for searchText', () => {
    const wrapper = shallow(<QuerySearch />);
    expect(wrapper.find('input')).to.have.length(1);
  });

  it('should have one Button', () => {
    const wrapper = shallow(<QuerySearch />);
    expect(wrapper.find(Button)).to.have.length(1);
  });
});
