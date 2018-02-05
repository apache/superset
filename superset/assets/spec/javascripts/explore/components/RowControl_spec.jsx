/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Button } from 'react-bootstrap';
import { CompactPicker } from 'react-color';

import RowControl from '../../../../javascripts/explore/components/controls/RowControl';
import SelectControl from '../../../../javascripts/explore/components/controls/SelectControl';

const defaultProps = {
  name: 'row configuration',
  value: {
    basements: ['Aaron', 'David'],
    fontOption: 'bold',
    coloringOption: {
      hex: '#B3B3B3',
      rgb: { r: 179, g: 179, b: 179, a: 1 },
    },
  },
  label: 'row configuration',
  onChange: sinon.spy(),
};

describe('RowControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<RowControl {...defaultProps} />);
  });

  it('renders 2 select sections, 1 color picker and 1 button', () => {
    expect(wrapper.find(SelectControl)).to.have.lengthOf(2);
    expect(wrapper.find(CompactPicker)).to.have.lengthOf(1);
    expect(wrapper.find(Button)).to.have.lengthOf(1);
  });
  it('renders 2 font weight choices', () => {
    expect(wrapper.find(SelectControl).at(1).prop('choices')).to.have.lengthOf(2);
  });
  it('calls onChange when select is changed or button is clicked', () => {
    const selectContains = wrapper.find(SelectControl).at(0);
    selectContains.simulate('change', { value: ['Aaron'] });
    const cancelButton = wrapper.find(Button);
    cancelButton.simulate('click');
    const selectFont = wrapper.find(SelectControl).at(1);
    selectFont.simulate('change', { value: 'normal' });
    expect(defaultProps.onChange).to.have.property('callCount', 3);
  });
});
