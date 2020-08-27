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
import { hot } from 'react-hot-loader/root';
import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { initFeatureFlags } from 'src/featureFlags';
import { supersetTheme, ThemeProvider } from '@superset-ui/style';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Menu from 'src/components/Menu/Menu';
import FlashProvider from 'src/components/FlashProvider';
import DashboardList from 'src/views/CRUD/dashboard/DashboardList';
import ChartList from 'src/views/CRUD/chart/ChartList';
import DatasetList from 'src/views/CRUD/data/dataset/DatasetList';
import DatasourceList from 'src/views/CRUD/data/database/DatabaseList';

import messageToastReducer from '../messageToasts/reducers';
import { initEnhancer } from '../reduxUtils';
import setupApp from '../setup/setupApp';
import setupPlugins from '../setup/setupPlugins';
import Welcome from './CRUD/welcome/Welcome';
import ToastPresenter from '../messageToasts/containers/ToastPresenter';
import {
  MenuObjectProps,
  MenuObjectChildProps,
} from '../components/Menu/MenuObject';

setupApp();
setupPlugins();

const container = document.getElementById('app');
const bootstrap = JSON.parse(container?.getAttribute('data-bootstrap') ?? '{}');
const user = { ...bootstrap.user };
const menu = { ...bootstrap.common.menu_data };
const common = { ...bootstrap.common };
initFeatureFlags(bootstrap.common.feature_flags);

const store = createStore(
  combineReducers({
    messageToasts: messageToastReducer,
  }),
  {},
  compose(applyMiddleware(thunk), initEnhancer(false)),
);

// Menu items that should go into settings dropdown
const settingsMenus = {
  Security: true,
  Manage: true,
};

// Menu items that should be ignored
const ignore = {
  'Import Dashboards': true,
};

// Cycle through menu.menu to build out cleanedMenu and settings
const cleanedMenu: object[] = [];
const settings: object[] = [];

menu.menu.forEach((item: any) => {
  if (!item) {
    return;
  }

  const children: (MenuObjectProps | string)[] = [];
  const newItem = {
    ...item,
  };

  // Filter childs
  if (item.childs) {
    item.childs.forEach((child: MenuObjectChildProps | string) => {
      if (typeof child === 'string') {
        children.push(child);
      } else if (
        (child as MenuObjectChildProps).label &&
        !ignore.hasOwnProperty(child.label)
      ) {
        children.push(child);
      }
    });

    newItem.childs = children;
  }

  if (!settingsMenus.hasOwnProperty(item.name)) {
    cleanedMenu.push(newItem);
  } else {
    settings.push(newItem);
  }
});

menu.menu = cleanedMenu;
menu.settings = settings;

const App = () => (
  <Provider store={store}>
    <ThemeProvider theme={supersetTheme}>
      <FlashProvider common={common}>
        <Router>
          <QueryParamProvider ReactRouterRoute={Route}>
            <Menu data={menu} />
            <Switch>
              <Route path="/superset/welcome/">
                <ErrorBoundary>
                  <Welcome user={user} />
                </ErrorBoundary>
              </Route>
              <Route path="/dashboard/list/">
                <ErrorBoundary>
                  <DashboardList user={user} />
                </ErrorBoundary>
              </Route>
              <Route path="/chart/list/">
                <ErrorBoundary>
                  <ChartList user={user} />
                </ErrorBoundary>
              </Route>
              <Route path="/tablemodelview/list/">
                <ErrorBoundary>
                  <DatasetList user={user} />
                </ErrorBoundary>
              </Route>
              <Route path="/databaseview/list/">
                <ErrorBoundary>
                  <DatasourceList user={user} />
                </ErrorBoundary>
              </Route>
            </Switch>
            <ToastPresenter />
          </QueryParamProvider>
        </Router>
      </FlashProvider>
    </ThemeProvider>
  </Provider>
);

export default hot(App);
