import React from 'react';
import { shallow } from 'enzyme';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';

import { user } from './fixtures';
import CreatedContent from '../../../src/profile/components/CreatedContent';
import TableLoader from '../../../src/components/TableLoader';

// store needed for withToasts(TableLoader)
const mockStore = configureStore([thunk]);
const store = mockStore({});

describe('CreatedContent', () => {
  const mockedProps = {
    user,
  };

  it('renders 2 TableLoader', () => {
    const wrapper = shallow(<CreatedContent {...mockedProps} />, { context: { store } });
    expect(wrapper.find(TableLoader)).toHaveLength(2);
  });

  it('renders 2 titles', () => {
    const wrapper = shallow(<CreatedContent {...mockedProps} />, { context: { store } });
    expect(wrapper.find('h3')).toHaveLength(2);
  });
});
