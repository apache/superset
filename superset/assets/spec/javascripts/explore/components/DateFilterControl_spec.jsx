/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Button } from 'react-bootstrap';

import DateFilterControl from '../../../../javascripts/explore/components/controls/DateFilterControl';
import ControlHeader from '../../../../javascripts/explore/components/ControlHeader';

const defaultProps = {
  animation: false,
  name: 'date',
  onChange: sinon.spy(),
  value: '90 days ago',
  label: 'date',
};

describe('DateFilterControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<DateFilterControl {...defaultProps} />);
  });

  it('renders a ControlHeader', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).to.have.lengthOf(1);
  });
  it('renders 3 Buttons', () => {
    const label = wrapper.find('.label').first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.find(Button)).to.have.length(3);
    }, 10);
  });
  it('loads the right state', () => {
    const label = wrapper.find('.label').first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.state().num).to.equal('90');
    }, 10);
  });
  it('renders 2 dimmed sections', () => {
    const label = wrapper.find('.label').first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.find(Button)).to.have.length(3);
    }, 10);
  });
  it('opens and closes', () => {
    const label = wrapper.find('.label').first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.find('.popover')).to.have.length(1);
      expect(wrapper.find('.ok')).first().simulate('click');
      setTimeout(() => {
        expect(wrapper.find('.popover')).to.have.length(0);
      }, 10);
    }, 10);
  });
});
