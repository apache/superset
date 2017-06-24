/* eslint-disable no-unused-expressions */
import React from 'react';
import { FormControl } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import AceEditor from 'react-ace';

import TextAreaControl from '../../../../javascripts/explore/components/controls/TextAreaControl';

const defaultProps = {
  name: 'x_axis_label',
  label: 'X Axis Label',
  onChange: sinon.spy(),
};

describe('SelectControl', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = shallow(<TextAreaControl {...defaultProps} />);
  });

  it('renders a FormControl', () => {
    expect(wrapper.find(FormControl)).to.have.lengthOf(1);
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find(FormControl);
    select.simulate('change', { target: { value: 'x' } });
    expect(defaultProps.onChange.calledWith('x')).to.be.true;
  });

  it('renders a AceEditor when language is specified', () => {
    const props = Object.assign({}, defaultProps);
    props.language = 'markdown';
    wrapper = shallow(<TextAreaControl {...props} />);
    expect(wrapper.find(FormControl)).to.have.lengthOf(0);
    expect(wrapper.find(AceEditor)).to.have.lengthOf(1);
  });
});
