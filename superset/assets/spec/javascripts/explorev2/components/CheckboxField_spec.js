/* eslint-disable no-unused-expressions */
import React from 'react';
import { Checkbox } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import CheckboxField from '../../../../javascripts/explorev2/components/CheckboxField';

const defaultProps = {
  name: 'show_legend',
  onChange: sinon.spy(),
};

describe('CheckboxField', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<CheckboxField {...defaultProps} />);
  });

  it('renders a Checkbox', () => {
    expect(wrapper.find(Checkbox)).to.have.lengthOf(1);
  });

  it('calls onChange when toggled', () => {
    const checkbox = wrapper.find(Checkbox);
    checkbox.simulate('change', { value: true });
    expect(defaultProps.onChange.calledWith('show_legend')).to.be.true;
  });
});
