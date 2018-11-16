/* eslint-disable no-unused-expressions */
import React from 'react';
import { shallow } from 'enzyme';
import { OverlayTrigger, Label } from 'react-bootstrap';

import ViewportControl from
  '../../../../src/explore/components/controls/ViewportControl';
import TextControl from
  '../../../../src/explore/components/controls/TextControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';

const defaultProps = {
  value: {
    longitude: 6.85236157047845,
    latitude: 31.222656842808707,
    zoom: 1,
    bearing: 0,
    pitch: 0,
  },
};

describe('ViewportControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    wrapper = shallow(<ViewportControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders a OverlayTrigger', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renders a Popover with 5 TextControl', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(TextControl)).toHaveLength(5);
  });

  it('renders a summary in the label', () => {
    expect(wrapper.find(Label).first().render().text()).toBe('6° 51\' 8.50" | 31° 13\' 21.56"');
  });
});
