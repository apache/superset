/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';

import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Checkbox from '../../../../src/components/Checkbox';

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
    expect(controlHeader).toHaveLength(1);

    const headerWrapper = controlHeader.shallow();
    expect(headerWrapper.find(Checkbox)).toHaveLength(1);
  });
});
