/* eslint-disable no-unused-expressions */
import React from 'react';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import Filter from '../../../../javascripts/explorev2/components/Filter';

const defaultProps = {
  actions: {
    fetchFilterValues: () => ({}),
  },
  filterColumnOpts: ['country_name'],
  filter: {
    id: 1,
    prefix: 'flt',
    col: 'country_name',
    eq: 'in',
    value: 'China',
  },
  prefix: 'flt',
};

describe('Filter', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<Filter {...defaultProps} />);
  });

  it('renders Filters', () => {
    expect(
      React.isValidElement(<Filter {...defaultProps} />)
    ).to.equal(true);
  });

  it('renders two select, one button and one input', () => {
    expect(wrapper.find(Select)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(1);
    expect(wrapper.find('input')).to.have.lengthOf(1);
  });
});
