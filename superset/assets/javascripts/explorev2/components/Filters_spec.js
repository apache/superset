/* eslint-disable no-unused-expressions */
import React from 'react';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import Filters from '../../../../javascripts/explorev2/components/Filters';
import Filter from '../../../../javascripts/explorev2/components/Filter';

const defaultProps = {
  filterColumnOpts: ['country_name'],
  filters: [
    {
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
    expect(wrapper.find(Filters)).to.have.lengthOf(1);
  });

  it('renders one filter, two select, two buttons and one input', () => {
    expect(wrapper.find(Filter)).to.have.lengthOf(1);
    expect(wrapper.find(Select)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
    expect(wrapper.find('input')).to.have.lengthOf(1);
  });

  it('calls removeFilter when remove button clicked', () => {
    const remove = sinon.spy(Filter.prototype, 'removeFilter');
    wrapper.find('#remove-button').simulate('click');
    /* eslint-disable no-unused-expressions */
    expect(remove).to.have.been.called;
    expect(wrapper.find(Filter)).to.have.lengthOf(0);
  });

  it('calls addFilter when plus button clicked', () => {
    const add = sinon.spy(Filters.prototype, 'addFilter');
    wrapper.find('#add-button').simulate('click');
    /* eslint-disable no-unused-expressions */
    expect(add).to.have.been.called;
    expect(wrapper.find(Filter)).to.have.lengthOf(2);
  });
});
