import React from 'react';
import { mount } from 'enzyme';

import { user } from './fixtures';
import RecentActivity from '../../../src/profile/components/RecentActivity';
import TableLoader from '../../../src/components/TableLoader';


describe('RecentActivity', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<RecentActivity {...mockedProps} />),
    ).toBe(true);
  });
  it('renders a TableLoader', () => {
    const wrapper = mount(<RecentActivity {...mockedProps} />);
    expect(wrapper.find(TableLoader)).toHaveLength(1);
  });
});
