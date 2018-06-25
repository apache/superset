import React from 'react';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

import { initEnhancer } from '../../../reduxUtils';
import { appSetup } from '../../../common';
import { initJQueryAjax } from '../../../modules/utils';
import DashboardContainer from './components/DashboardContainer';
import rootReducer, { getInitialState } from './reducers';

appSetup();
initJQueryAjax();

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
const initState = Object.assign({}, getInitialState(bootstrapData));

const store = createStore(
  rootReducer, initState, compose(applyMiddleware(thunk), initEnhancer(false)));

ReactDOM.render(
  <Provider store={store}>
    <DashboardContainer />
  </Provider>,
  appContainer,
);
