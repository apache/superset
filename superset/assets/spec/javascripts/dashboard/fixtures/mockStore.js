import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';

import rootReducer from '../../../../src/dashboard/reducers/index';

import mockState from './mockState';
import { dashboardLayoutWithTabs } from './mockDashboardLayout';

export const mockStore = createStore(
  rootReducer,
  mockState,
  compose(applyMiddleware(thunk)),
);

export const mockStoreWithTabs = createStore(
  rootReducer,
  {
    ...mockState,
    dashboardLayout: dashboardLayoutWithTabs,
  },
  compose(applyMiddleware(thunk)),
);
