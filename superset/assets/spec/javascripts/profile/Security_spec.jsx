import React from 'react';
import { mount } from 'enzyme';

import { user, userNoPerms } from './fixtures';
import Security from '../../../src/profile/components/Security';


describe('Security', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<Security {...mockedProps} />),
    ).toBe(true);
  });
  it('renders 2 role labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.roles').find('.label')).toHaveLength(2);
  });
  it('renders 2 datasource labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.datasources').find('.label')).toHaveLength(2);
  });
  it('renders 3 database labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.databases').find('.label')).toHaveLength(3);
  });
  it('renders no permission label when empty', () => {
    const wrapper = mount(<Security user={userNoPerms} />);
    expect(wrapper.find('.datasources').find('.label')).toHaveLength(0);
    expect(wrapper.find('.databases').find('.label')).toHaveLength(0);
  });
});
