import React from 'react';
import { createStore, compose, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunkMiddleware from 'redux-thunk';
import { hot } from 'react-hot-loader';

import { initFeatureFlags } from 'src/featureFlags';
import getInitialState from './getInitialState';
import rootReducer from './reducers';
import { initEnhancer } from '../reduxUtils';
import App from './components/App';
import { appSetup } from '../common';

import './main.less';
import '../../stylesheets/reactable-pagination.css';
import '../components/FilterableTable/FilterableTableStyles.css';

appSetup();

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
initFeatureFlags(bootstrapData.common.feature_flags);
const state = getInitialState(bootstrapData);

const store = createStore(
  rootReducer,
  state,
  compose(
    applyMiddleware(thunkMiddleware),
    initEnhancer(),
  ),
);

// Highlight the navbar menu
const menus = document.querySelectorAll('.nav.navbar-nav li.dropdown');
const sqlLabMenu = Array.prototype.slice.apply(menus)
  .find(element => element.innerText.trim() === 'SQL Lab');
if (sqlLabMenu) {
  const classes = sqlLabMenu.getAttribute('class');
  if (classes.indexOf('active') === -1) {
    sqlLabMenu.setAttribute('class', `${classes} active`);
  }
}

const Application = () => (
  <Provider store={store}>
    <App />
  </Provider>
);

export default hot(module)(Application);
