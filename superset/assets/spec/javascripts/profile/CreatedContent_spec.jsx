import React from 'react';
import { mount } from 'enzyme';
import { user } from './fixtures';
import CreatedContent from '../../../src/profile/components/CreatedContent';
import TableLoader from '../../../src/components/TableLoader';


describe('CreatedContent', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<CreatedContent {...mockedProps} />),
    ).toBe(true);
  });
  it('renders 2 TableLoader', () => {
    const wrapper = mount(<CreatedContent {...mockedProps} />);
    expect(wrapper.find(TableLoader)).toHaveLength(2);
  });
  it('renders 2 titles', () => {
    const wrapper = mount(<CreatedContent {...mockedProps} />);
    expect(wrapper.find('h3')).toHaveLength(2);
  });
});
