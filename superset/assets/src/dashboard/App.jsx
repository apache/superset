import React from 'react';
import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import { hot } from 'react-hot-loader';

import { initEnhancer } from '../reduxUtils';
import { appSetup } from '../common';
import DashboardContainer from './containers/Dashboard';
import getInitialState from './reducers/getInitialState';
import rootReducer from './reducers/index';

appSetup();

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
const initState = getInitialState(bootstrapData);

const store = createStore(
  rootReducer,
  initState,
  compose(
    applyMiddleware(thunk),
    initEnhancer(false),
  ),
);

const App = () => (
  <Provider store={store}>
    <DashboardContainer />
  </Provider>
);

export default hot(module)(App);
