import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { shallow } from 'enzyme';

import { STATUS_OPTIONS } from '../../../src/SqlLab/constants';
import { initialState } from './fixtures';
import SouthPane from '../../../src/SqlLab/components/SouthPane';

describe('SouthPane', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(initialState);

  const mockedProps = {
    editorQueries: [],
    dataPreviewQueries: [],
    actions: {},
    activeSouthPaneTab: '',
    height: 1,
    databases: {},
    offline: false,
  };

  const getWrapper = () => (
    shallow(<SouthPane {...mockedProps} />, {
      context: { store },
    }).dive());

  let wrapper;
  it('should render offline when the state is offline', () => {
    wrapper = getWrapper();
    wrapper.setProps({ offline: true });
    expect(wrapper.find('.m-r-3').render().text()).toBe(STATUS_OPTIONS.offline);
  });
});
