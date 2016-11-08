/* eslint-disable no-unused-expressions */
import React from 'react';
import { FormControl } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import SelectField from '../../../../javascripts/explorev2/components/SelectField';

const defaultProps = {
  name: 'row_limit',
  label: 'Row Limit',
  onChange: sinon.spy(),
};

describe('SelectField', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<SelectField {...defaultProps} />);
  });

  it('renders a FormControl', () => {
    expect(wrapper.find(FormControl)).to.have.lengthOf(1);
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find(FormControl);
    select.simulate('change', { target: { value: 50 } });
    expect(defaultProps.onChange.calledWith('row_limit', 50)).to.be.true;
  });
});
