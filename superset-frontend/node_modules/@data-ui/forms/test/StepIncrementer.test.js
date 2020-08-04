import React from 'react';
import { shallow } from 'enzyme';

import Button from '../src/Button';
import StepIncrementer from '../src/StepIncrementer';

describe('<StepIncrementer />', () => {
  it('it should be defined', () => {
    expect(StepIncrementer).toBeDefined();
  });

  it('It should render two Buttons', () => {
    const wrapper = shallow(<StepIncrementer />);
    expect(wrapper.find(Button)).toHaveLength(2);
  });

  it('It should call onChange when clicked', () => {
    const onChange = jest.fn(() => {});
    const wrapper = shallow(<StepIncrementer onChange={onChange} />);

    wrapper
      .find(Button)
      .at(0)
      .simulate('click');
    wrapper
      .find(Button)
      .at(1)
      .simulate('click');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('It should use formatValue to format the step', () => {
    const wrapper = shallow(<StepIncrementer formatValue={() => <span className="test" />} />);
    expect(wrapper.find('.test')).toHaveLength(1);
  });

  it('It should limit its range to within [min, max]', () => {
    const wrapper = shallow(<StepIncrementer min={-1} max={1} value={0} />);
    const decrement = wrapper.find(Button).at(0);
    const increment = wrapper.find(Button).at(1);

    expect(wrapper.state('value')).toBe(0);
    decrement.simulate('click');
    expect(wrapper.state('value')).toBe(-1);
    decrement.simulate('click');
    expect(wrapper.state('value')).toBe(-1);

    increment.simulate('click');
    expect(wrapper.state('value')).toBe(0);
    increment.simulate('click');
    expect(wrapper.state('value')).toBe(1);
    increment.simulate('click');
    expect(wrapper.state('value')).toBe(1);
  });

  it('It should skip zero when disableZero=true', () => {
    const wrapper = shallow(<StepIncrementer min={-1} max={1} value={1} disableZero />);
    const decrement = wrapper.find(Button).at(0);
    const increment = wrapper.find(Button).at(1);

    expect(wrapper.state('value')).toBe(1);

    decrement.simulate('click');
    expect(wrapper.state('value')).toBe(-1);

    increment.simulate('click');
    expect(wrapper.state('value')).toBe(1);
  });
});
