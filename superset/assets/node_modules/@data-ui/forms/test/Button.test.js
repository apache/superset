import React from 'react';
import { shallow } from 'enzyme';
import Button from '../src/Button';

describe('<Button />', () => {
  test('it should be defined', () => {
    expect(Button).toBeDefined();
  });

  test('It should render a button', () => {
    const wrapper = shallow(<Button />);
    expect(wrapper.find('button').length).toBe(1);
  });

  test('It should render children', () => {
    const wrapper = shallow(<Button><span className="test" /></Button>);
    expect(wrapper.find('.test').length).toBe(1);
  });

  test('It should call onClick when clicked', () => {
    const onClick = jest.fn(() => {});
    const wrapper = shallow(<Button onClick={onClick} />);

    wrapper.find('button').simulate('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
