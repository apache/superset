/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { Button, Label } from 'react-bootstrap';

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

  beforeEach(() => {
    wrapper = shallow(<DateFilterControl {...defaultProps} />);
  });

  it('renders a ControlHeader', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);
  });
  it('renders 3 Buttons', () => {
    const label = wrapper.find(Label).first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.find(Button)).toHaveLength(3);
    }, 10);
  });
  it('loads the right state', () => {
    const label = wrapper.find(Label).first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.state().num).toBe('90');
    }, 10);
  });
  it('renders 2 dimmed sections', () => {
    const label = wrapper.find(Label).first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.find(Button)).toHaveLength(3);
    }, 10);
  });
  it('opens and closes', () => {
    const label = wrapper.find(Label).first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.find('.popover')).toHaveLength(1);
      expect(wrapper.find('.ok')).first().simulate('click');
      setTimeout(() => {
        expect(wrapper.find('.popover')).toHaveLength(0);
      }, 10);
    }, 10);
  });
});
