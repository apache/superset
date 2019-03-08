import React from 'react';
import { createStore, compose, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunkMiddleware from 'redux-thunk';
import { hot } from 'react-hot-loader';

import { initFeatureFlags } from 'src/featureFlags';
import getInitialState from './reducers/getInitialState';
import rootReducer from './reducers/index';
import { initEnhancer } from '../reduxUtils';
import App from './components/App';
import setupApp from '../setup/setupApp';

import './main.less';
import '../../stylesheets/reactable-pagination.css';
import '../components/FilterableTable/FilterableTableStyles.css';

setupApp();

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
initFeatureFlags(bootstrapData.common.feature_flags);
const initialState = getInitialState(bootstrapData);
const sqlLabPersistStateConfig = {
  paths: ['sqlLab'],
  config: {
    slicer: paths => (state) => {
      const subset = {};
      paths.forEach((path) => {
        // this line is used to remove old data from browser localStorage.
        // we used to persist all redux state into localStorage, but
        // it caused configurations passed from server-side got override.
        // see PR 6257 for details
        delete state[path].common; // eslint-disable-line no-param-reassign
        subset[path] = state[path];
      });
      return subset;
    },
  },
};

const store = createStore(
  rootReducer,
  initialState,
  compose(
    applyMiddleware(thunkMiddleware),
    initEnhancer(true, sqlLabPersistStateConfig),
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
