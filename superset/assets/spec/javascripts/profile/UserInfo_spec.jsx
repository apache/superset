import React from 'react';
import Gravatar from 'react-gravatar';
import { Panel } from 'react-bootstrap';
import { mount } from 'enzyme';

import { user } from './fixtures';
import UserInfo from '../../../src/profile/components/UserInfo';


describe('UserInfo', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<UserInfo {...mockedProps} />),
    ).toBe(true);
  });
  it('renders a Gravatar', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find(Gravatar)).toHaveLength(1);
  });
  it('renders a Panel', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find(Panel)).toHaveLength(1);
  });
  it('renders 5 icons', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find('i')).toHaveLength(5);
  });
  it('renders roles information', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find('.roles').text()).toBe(' Alpha, sql_lab');
  });
  it('shows the right user-id', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find('.user-id').text()).toBe('5');
  });
});
