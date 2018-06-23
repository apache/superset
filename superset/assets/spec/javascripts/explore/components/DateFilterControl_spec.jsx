/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Button } from 'react-bootstrap';

import DateFilterControl from '../../../../src/explore/components/controls/DateFilterControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';

const defaultProps = {
  animation: false,
  name: 'date',
  onChange: sinon.spy(),
  value: '90 days ago',
  label: 'date',
};

describe('DateFilterControl', () => {
  let wrapper;
  let popover;

  beforeEach(() => {
    wrapper = shallow(<DateFilterControl {...defaultProps} />);
    popover = shallow(wrapper.instance().renderPopover());
  });

  it('renders a ControlHeader', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).to.have.lengthOf(1);
  });
  it('renders 3 Buttons', () => {
    expect(popover.find(Button)).to.have.length(3);
  });
  it('loads the right state', () => {
    expect(wrapper.state().num).to.equal('90');
  });
  it('renders 2 dimmed sections', () => {
    expect(popover.find(Button)).to.have.length(3);
  });
});
