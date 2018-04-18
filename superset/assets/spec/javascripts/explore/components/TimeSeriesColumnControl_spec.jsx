/* eslint-disable no-unused-expressions */
import React from 'react';
import { FormControl, OverlayTrigger } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';

import TimeSeriesColumnControl from '../../../../src/explore/components/controls/TimeSeriesColumnControl';

const defaultProps = {
  name: 'x_axis_label',
  label: 'X Axis Label',
  onChange: sinon.spy(),
};

describe('SelectControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    wrapper = shallow(<TimeSeriesColumnControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders an OverlayTrigger', () => {
    expect(wrapper.find(OverlayTrigger)).to.have.lengthOf(1);
  });

  it('renders an Popover', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(FormControl)).to.have.lengthOf(3);
  });
});
