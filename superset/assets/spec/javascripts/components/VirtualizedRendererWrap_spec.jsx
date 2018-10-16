/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import PropTypes from 'prop-types';
import { shallow } from 'enzyme';

import VirtualizedRendererWrap from '../../../src/components/VirtualizedRendererWrap';

const defaultProps = {
  focusedOption: { label: 'focusedOn', value: 'focusedOn' },
  focusOption: sinon.spy(),
  key: 'key1',
  option: { label: 'option1', value: 'option1' },
  selectValue: sinon.spy(),
  valueArray: [],
};

function TestOption({ option }) {
  return (
    <span>{option.label}</span>
  );
}
TestOption.propTypes = {
  option: PropTypes.object.isRequired,
};

const defaultRenderer = opt => <TestOption option={opt} />;
const RendererWrap = VirtualizedRendererWrap(defaultRenderer);

describe('VirtualizedRendererWrap', () => {
  let wrapper;
  let props;
  beforeEach(() => {
    wrapper = shallow(<RendererWrap {...defaultProps} />);
    props = Object.assign({}, defaultProps);
  });

  it('uses the provided renderer', () => {
    const option = wrapper.find(TestOption);
    expect(option).toHaveLength(1);
  });

  it('renders nothing when no option is provided', () => {
    props.option = null;
    wrapper = shallow(<RendererWrap {...props} />);
    const option = wrapper.find(TestOption);
    expect(option).toHaveLength(0);
  });

  it('renders unfocused, unselected options with the default class', () => {
    const optionDiv = wrapper.find('div');
    expect(optionDiv).toHaveLength(1);
    expect(optionDiv.props().className).toBe('VirtualizedSelectOption');
  });

  it('renders focused option with the correct class', () => {
    props.option = props.focusedOption;
    wrapper = shallow(<RendererWrap {...props} />);
    const optionDiv = wrapper.find('div');
    expect(optionDiv.props().className).toBe('VirtualizedSelectOption VirtualizedSelectFocusedOption');
  });

  it('renders disabled option with the correct class', () => {
    props.option.disabled = true;
    wrapper = shallow(<RendererWrap {...props} />);
    const optionDiv = wrapper.find('div');
    expect(optionDiv.props().className).toBe('VirtualizedSelectOption VirtualizedSelectDisabledOption');
    props.option.disabled = false;
  });

  it('renders selected option with the correct class', () => {
    props.valueArray = [props.option, props.focusedOption];
    wrapper = shallow(<RendererWrap {...props} />);
    const optionDiv = wrapper.find('div');
    expect(optionDiv.props().className).toBe('VirtualizedSelectOption VirtualizedSelectSelectedOption');
  });

  it('renders options with custom classes', () => {
    props.option.className = 'CustomClass';
    wrapper = shallow(<RendererWrap {...props} />);
    const optionDiv = wrapper.find('div');
    expect(optionDiv.props().className).toBe('VirtualizedSelectOption CustomClass');
  });

  it('calls focusedOption on its own option onMouseEnter', () => {
    const optionDiv = wrapper.find('div');
    optionDiv.simulate('mouseEnter');
    expect(props.focusOption.calledWith(props.option)).toBe(true);
  });

  it('calls selectValue on its own option onClick', () => {
    const optionDiv = wrapper.find('div');
    optionDiv.simulate('click');
    expect(props.selectValue.calledWith(props.option)).toBe(true);
  });
});
