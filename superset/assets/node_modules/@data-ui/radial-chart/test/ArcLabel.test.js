import React from 'react';
import { shallow } from 'enzyme';
import { ArcLabel } from '../src';

describe('<ArcLabel />', () => {
  test('it should be defined', () => {
    expect(ArcLabel).toBeDefined();
  });

  test('it should render a text element', () => {
    const wrapper = shallow(<ArcLabel />);
    expect(wrapper.find('text').length).toBe(1);
  });

  test('it should set x and y', () => {
    const wrapper = shallow(<ArcLabel x={1} y={100} />);
    expect(wrapper.props().x).toBe(1);
    expect(wrapper.props().y).toBe(100);
  });

  test('it should pass ...restProps', () => {
    const wrapper = shallow(<ArcLabel fill="myfavoritecolor" />);
    expect(wrapper.props().fill).toBe('myfavoritecolor');
  });
});
