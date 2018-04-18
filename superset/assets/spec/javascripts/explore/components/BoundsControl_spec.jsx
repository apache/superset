/* eslint-disable no-unused-expressions */
import React from 'react';
import { FormControl } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { mount } from 'enzyme';

import BoundsControl from '../../../../src/explore/components/controls/BoundsControl';

const defaultProps = {
  name: 'y_axis_bounds',
  label: 'Bounds of the y axis',
  onChange: sinon.spy(),
};

describe('BoundsControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(<BoundsControl {...defaultProps} />);
  });

  it('renders two FormControls', () => {
    expect(wrapper.find(FormControl)).to.have.lengthOf(2);
  });

  it('errors on non-numeric', () => {
    wrapper.find(FormControl).first().simulate('change', { target: { value: 's' } });
    expect(defaultProps.onChange.calledWith([null, null])).to.be.true;
    expect(defaultProps.onChange.getCall(0).args[1][0]).to.contain('value should be numeric');
  });
  it('casts to numeric', () => {
    wrapper.find(FormControl).first().simulate('change', { target: { value: '1' } });
    wrapper.find(FormControl).last().simulate('change', { target: { value: '5' } });
    expect(defaultProps.onChange.calledWith([1, 5])).to.be.true;
  });
});
