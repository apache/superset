/* eslint-disable no-unused-expressions */
import React from 'react';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import Filter from '../../../../javascripts/explorev2/components/Filter';
import SelectField from '../../../../javascripts/explorev2/components/SelectField';

const defaultProps = {
  choices: ['country_name'],
  opChoices: ['in', 'not in'],
  changeFilter: sinon.spy(),
  removeFilter: () => {
    // noop
  },
  filter: {
    col: null,
    op: 'in',
    value: '',
  },
  datasource: {
    id: 1,
    type: 'table',
    filter_select: false,
  },
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

  it('renders two selects, one button and one input', () => {
    expect(wrapper.find(Select)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(1);
    expect(wrapper.find(SelectField)).to.have.lengthOf(1);
  });

  it('calls changeFilter when select is changed', () => {
    const selectCol = wrapper.find('#select-col');
    selectCol.simulate('change', { value: 'col' });
    const selectOp = wrapper.find('#select-op');
    selectOp.simulate('change', { value: 'in' });
    const selectVal = wrapper.find(SelectField);
    selectVal.simulate('change', { value: 'x' });
    expect(defaultProps.changeFilter).to.have.property('callCount', 3);
  });
});
