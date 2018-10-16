/* eslint-disable no-unused-expressions */
import React from 'react';
import { FormControl } from 'react-bootstrap';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import AceEditor from 'react-ace';

import TextAreaControl from '../../../../src/explore/components/controls/TextAreaControl';

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
    expect(wrapper.find(FormControl)).toHaveLength(1);
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find(FormControl);
    select.simulate('change', { target: { value: 'x' } });
    expect(defaultProps.onChange.calledWith('x')).toBe(true);
  });

  it('renders a AceEditor when language is specified', () => {
    const props = Object.assign({}, defaultProps);
    props.language = 'markdown';
    wrapper = shallow(<TextAreaControl {...props} />);
    expect(wrapper.find(FormControl)).toHaveLength(0);
    expect(wrapper.find(AceEditor)).toHaveLength(1);
  });
});
