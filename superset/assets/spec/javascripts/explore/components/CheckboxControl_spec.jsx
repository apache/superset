/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';

import CheckboxControl from '../../../../javascripts/explore/components/controls/CheckboxControl';
import ControlHeader from '../../../../javascripts/explore/components/ControlHeader';
import Checkbox from '../../../../javascripts/components/Checkbox';

const defaultProps = {
  name: 'show_legend',
  onChange: sinon.spy(),
  value: false,
  label: 'checkbox label',
};

describe('CheckboxControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<CheckboxControl {...defaultProps} />);
  });

  it('renders a Checkbox', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).to.have.lengthOf(1);

    const headerWrapper = controlHeader.shallow();
    expect(headerWrapper.find(Checkbox)).to.have.length(1);
  });
});
