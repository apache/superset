/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import { createStore, compose, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunkMiddleware from 'redux-thunk';
import { hot } from 'react-hot-loader/root';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import {
  initFeatureFlags,
  isFeatureEnabled,
  FeatureFlag,
} from 'src/featureFlags';
import getInitialState from './reducers/getInitialState';
import rootReducer from './reducers/index';
import { initEnhancer } from '../reduxUtils';
import App from './components/App';
import {
  emptyQueryResults,
  clearQueryEditors,
} from './utils/reduxStateToLocalStorageHelper';
import { BYTES_PER_CHAR, KB_STORAGE } from './constants';
import setupApp from '../setup/setupApp';

import './main.less';
import '../../stylesheets/reactable-pagination.less';
import '../components/FilterableTable/FilterableTableStyles.less';

setupApp();

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));

initFeatureFlags(bootstrapData.common.feature_flags);

const initialState = getInitialState(bootstrapData);
const sqlLabPersistStateConfig = {
  paths: ['sqlLab'],
  config: {
    slicer: paths => state => {
      const subset = {};
      paths.forEach(path => {
        // this line is used to remove old data from browser localStorage.
        // we used to persist all redux state into localStorage, but
        // it caused configurations passed from server-side got override.
        // see PR 6257 for details
        delete state[path].common; // eslint-disable-line no-param-reassign
        if (path === 'sqlLab') {
          subset[path] = {
            ...state[path],
            queries: emptyQueryResults(state[path].queries),
            queryEditors: clearQueryEditors(state[path].queryEditors),
          };
        }
      });

      const data = JSON.stringify(subset);
      // 2 digit precision
      const currentSize =
        Math.round(((data.length * BYTES_PER_CHAR) / KB_STORAGE) * 100) / 100;
      if (state.localStorageUsageInKilobytes !== currentSize) {
        state.localStorageUsageInKilobytes = currentSize; // eslint-disable-line no-param-reassign
      }

      return subset;
    },
  },
};

const store = createStore(
  rootReducer,
  initialState,
  compose(
    applyMiddleware(thunkMiddleware),
    initEnhancer(
      !isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE),
      sqlLabPersistStateConfig,
    ),
  ),
);

// Highlight the navbar menu
const menus = document.querySelectorAll('.nav.navbar-nav li.dropdown');
const sqlLabMenu = Array.prototype.slice
  .apply(menus)
  .find(element => element.innerText.trim() === 'SQL Lab');
if (sqlLabMenu) {
  const classes = sqlLabMenu.getAttribute('class');
  if (classes.indexOf('active') === -1) {
    sqlLabMenu.setAttribute('class', `${classes} active`);
  }
}

const Application = () => (
  <Provider store={store}>
    <ThemeProvider theme={supersetTheme}>
      <App />
    </ThemeProvider>
  </Provider>
);

export default hot(Application);
