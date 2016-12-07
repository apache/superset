/* eslint-disable no-unused-expressions */
import React from 'react';
import { Button } from 'react-bootstrap';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Filters } from '../../../../javascripts/explorev2/components/Filters';
import Filter from '../../../../javascripts/explorev2/components/Filter';

const defaultProps = {
  filterColumnOpts: ['country_name'],
  filters: [
    {
      id: 1,
      prefix: 'flt',
      col: 'country_name',
      eq: 'in',
      value: 'China',
    }],
  prefix: 'flt',
};

describe('Filters', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<Filters {...defaultProps} />);
  });

  it('renders Filters', () => {
    expect(
      React.isValidElement(<Filters {...defaultProps} />)
    ).to.equal(true);
  });

  it('renders one filter', () => {
    expect(wrapper.find(Filter)).to.have.lengthOf(1);
    expect(wrapper.find(Button)).to.have.lengthOf(1);
  });
});
