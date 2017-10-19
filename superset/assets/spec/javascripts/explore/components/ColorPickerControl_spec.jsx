/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';
import { SketchPicker } from 'react-color';

import ColorPickerControl from
  '../../../../javascripts/explore/components/controls/ColorPickerControl';
import ControlHeader from '../../../../javascripts/explore/components/ControlHeader';

const defaultProps = {
  value: { },
};

describe('ColorPickerControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    wrapper = shallow(<ColorPickerControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders a OverlayTrigger', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).to.have.lengthOf(1);
    expect(wrapper.find(OverlayTrigger)).to.have.length(1);
  });

  it('renders a OverlayTrigger', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).to.have.lengthOf(1);
    expect(wrapper.find(OverlayTrigger)).to.have.length(1);
  });

  it('renders a Popover with a SketchPicker', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(SketchPicker)).to.have.lengthOf(1);
  });
});
