/* eslint-disable no-unused-expressions */
import React from 'react';
import { shallow } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';

import FixedOrMetricControl from
  '../../../../src/explore/components/controls/FixedOrMetricControl';
import TextControl from
  '../../../../src/explore/components/controls/TextControl';
import MetricsControl from
  '../../../../src/explore/components/controls/MetricsControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';

const defaultProps = {
  value: { },
};

describe('FixedOrMetricControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    wrapper = shallow(<FixedOrMetricControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders a OverlayTrigger', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renders a TextControl and a SelectControl', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(TextControl)).toHaveLength(1);
    expect(popOver.find(MetricsControl)).toHaveLength(1);
  });
});
