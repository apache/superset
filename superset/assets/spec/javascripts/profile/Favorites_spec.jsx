import React from 'react';
import { mount } from 'enzyme';

import { user } from './fixtures';
import Favorites from '../../../src/profile/components/Favorites';
import TableLoader from '../../../src/components/TableLoader';

describe('Favorites', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<Favorites {...mockedProps} />),
    ).toBe(true);
  });
  it('renders 2 TableLoader', () => {
    const wrapper = mount(<Favorites {...mockedProps} />);
    expect(wrapper.find(TableLoader)).toHaveLength(2);
  });
  it('renders 2 titles', () => {
    const wrapper = mount(<Favorites {...mockedProps} />);
    expect(wrapper.find('h3')).toHaveLength(2);
  });
});
