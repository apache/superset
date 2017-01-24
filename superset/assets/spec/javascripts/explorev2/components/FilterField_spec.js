/* eslint-disable no-unused-expressions */
import React from 'react';
import { Button } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import FilterField from '../../../../javascripts/explorev2/components/FilterField';
import Filter from '../../../../javascripts/explorev2/components/Filter';

const defaultProps = {
  choices: ['country_name'],
  prefix: 'flt',
  onChange: sinon.spy(),
  value: [],
  datasource: {
    id: 1,
    type: 'table',
    filter_select: false,
  },
};

describe('FilterField', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<FilterField {...defaultProps} />);
  });

  it('renders Filters', () => {
    expect(
      React.isValidElement(<FilterField {...defaultProps} />)
    ).to.equal(true);
  });

  it('renders one button', () => {
    expect(wrapper.find(Filter)).to.have.lengthOf(0);
    expect(wrapper.find(Button)).to.have.lengthOf(1);
  });

  it('add a filter when Add Filter button is clicked', () => {
    const addButton = wrapper.find('#add-button');
    expect(addButton).to.have.lengthOf(1);
    addButton.simulate('click');
    expect(defaultProps.onChange).to.have.property('callCount', 1);
  });
});
