/* eslint-disable no-unused-expressions */
import React from 'react';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { FilterField } from '../../../../javascripts/explorev2/components/FilterField';

const defaultProps = {
  choices: ['country_name'],
  prefix: 'flt',
  onChange: sinon.spy(),
  renderFilterSelect: false,
  value: [{
    id: 1,
    prefix: 'flt',
    col: null,
    op: 'in',
    value: '',
  }],
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

  it('renders two selects, two buttons and one input', () => {
    expect(wrapper.find(Select)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
    expect(wrapper.find('input')).to.have.lengthOf(1);
  });

  it('calls onChange when select is changed', () => {
    const selectCol = wrapper.find('#select-col');
    selectCol.simulate('change', { value: 'col' });
    const selectOp = wrapper.find('#select-op');
    selectOp.simulate('change', { value: 'in' });
    const input = wrapper.find('input');
    input.simulate('change', { target: { value: 'x' } });
    expect(defaultProps.onChange).to.have.property('callCount', 3);
  });

  it('removes a filter when Remove Filter button is clicked', () => {
    const removeButton = wrapper.find('#remove-button');
    expect(removeButton).to.have.lengthOf(1);
    removeButton.simulate('click');
    expect(defaultProps.onChange.calledWith([])).to.be.true;
  });

  it('add a filter when Add Filter button is clicked', () => {
    expect(wrapper.find('#remove-button')).to.have.lengthOf(1);
    const addButton = wrapper.find('#add-button');
    expect(addButton).to.have.lengthOf(1);
    addButton.simulate('click');
  });
});
