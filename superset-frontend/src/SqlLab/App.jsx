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
import { Provider } from 'react-redux';
import { hot } from 'react-hot-loader/root';
import {
  FeatureFlag,
  ThemeProvider,
  initFeatureFlags,
  isFeatureEnabled,
} from '@superset-ui/core';
import { GlobalStyles } from 'src/GlobalStyles';
import { setupStore, userReducer } from 'src/views/store';
import setupExtensions from 'src/setup/setupExtensions';
import getBootstrapData from 'src/utils/getBootstrapData';
import { persistSqlLabStateEnhancer } from 'src/SqlLab/middlewares/persistSqlLabStateEnhancer';
import getInitialState from './reducers/getInitialState';
import { reducers } from './reducers/index';
import App from './components/App';
import { rehydratePersistedState } from './utils/reduxStateToLocalStorageHelper';
import setupApp from '../setup/setupApp';

import '../assets/stylesheets/reactable-pagination.less';
import { theme } from '../preamble';
import { SqlLabGlobalStyles } from './SqlLabGlobalStyles';

setupApp();
setupExtensions();

const bootstrapData = getBootstrapData();

initFeatureFlags(bootstrapData.common.feature_flags);

const initialState = getInitialState(bootstrapData);

export const store = setupStore({
  initialState,
  rootReducers: { ...reducers, user: userReducer },
  ...(!isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE) && {
    enhancers: [persistSqlLabStateEnhancer],
  }),
});

rehydratePersistedState(store.dispatch, initialState);

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
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <SqlLabGlobalStyles />
      <App />
    </ThemeProvider>
  </Provider>
);

export default hot(Application);
