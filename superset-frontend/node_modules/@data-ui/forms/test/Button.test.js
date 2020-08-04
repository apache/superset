import React from 'react';
import { shallow } from 'enzyme';
import Button from '../src/Button';

describe('<Button />', () => {
  it('it should be defined', () => {
    expect(Button).toBeDefined();
  });

  it('It should render a button', () => {
    const wrapper = shallow(<Button />);
    expect(wrapper.find('button')).toHaveLength(1);
  });

  it('It should render children', () => {
    const wrapper = shallow(
      <Button>
        <span className="test" />
      </Button>,
    );
    expect(wrapper.find('.test')).toHaveLength(1);
  });

  it('It should call onClick when clicked', () => {
    const onClick = jest.fn(() => {});
    const wrapper = shallow(<Button onClick={onClick} />);

    wrapper.find('button').simulate('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
