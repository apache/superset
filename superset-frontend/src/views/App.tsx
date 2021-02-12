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
import React, { lazy, Suspense } from 'react';
import { hot } from 'react-hot-loader/root';
import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import { Provider as ReduxProvider } from 'react-redux';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { initFeatureFlags } from 'src/featureFlags';
import { ThemeProvider } from '@superset-ui/core';
import { DynamicPluginProvider } from 'src/components/DynamicPlugins';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Loading from 'src/components/Loading';
import Menu from 'src/components/Menu/Menu';
import FlashProvider from 'src/components/FlashProvider';
import Welcome from 'src/views/CRUD/welcome/Welcome';
import { theme } from 'src/preamble';
import ToastPresenter from 'src/messageToasts/containers/ToastPresenter';
import setupPlugins from 'src/setup/setupPlugins';
import setupApp from 'src/setup/setupApp';
import messageToastReducer from 'src/messageToasts/reducers';
import { initEnhancer } from 'src/reduxUtils';

const AnnotationLayersList = lazy(
  () =>
    import(
      /* webpackChunkName: "AnnotationLayersList" */ 'src/views/CRUD/annotationlayers/AnnotationLayersList'
    ),
);
const AlertList = lazy(
  () =>
    import(
      /* webpackChunkName: "AlertList" */ 'src/views/CRUD/alert/AlertList'
    ),
);
const AnnotationList = lazy(
  () =>
    import(
      /* webpackChunkName: "AnnotationList" */ 'src/views/CRUD/annotation/AnnotationList'
    ),
);
const ChartList = lazy(
  () =>
    import(
      /* webpackChunkName: "ChartList" */ 'src/views/CRUD/chart/ChartList'
    ),
);
const CssTemplatesList = lazy(
  () =>
    import(
      /* webpackChunkName: "CssTemplatesList" */ 'src/views/CRUD/csstemplates/CssTemplatesList'
    ),
);
const DashboardList = lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardList" */ 'src/views/CRUD/dashboard/DashboardList'
    ),
);
const DatabaseList = lazy(
  () =>
    import(
      /* webpackChunkName: "DatabaseList" */ 'src/views/CRUD/data/database/DatabaseList'
    ),
);
const DatasetList = lazy(
  () =>
    import(
      /* webpackChunkName: "DatasetList" */ 'src/views/CRUD/data/dataset/DatasetList'
    ),
);
const ExecutionLog = lazy(
  () =>
    import(
      /* webpackChunkName: "ExecutionLog" */ 'src/views/CRUD/alert/ExecutionLog'
    ),
);
const QueryList = lazy(
  () =>
    import(
      /* webpackChunkName: "QueryList" */ 'src/views/CRUD/data/query/QueryList'
    ),
);
const SavedQueryList = lazy(
  () =>
    import(
      /* webpackChunkName: "SavedQueryList" */ 'src/views/CRUD/data/savedquery/SavedQueryList'
    ),
);

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
const routes = {
  welcome: '/superset/welcome/',
  dashboards: '/dashboard/list/',
  charts: '/chart/list/',
  datasets: '/tablemodelview/list/',
  databases: '/databaseview/list/',
  savedQueries: '/savedqueryview/list/',
  cssTemplates: '/csstemplatemodelview/list/',
  annotationLayers: '/annotationlayermodelview/list/',
  annotations: '/annotationmodelview/:annotationLayerId/annotation/',
  queries: '/superset/sqllab/history/',
  alerts: '/alert/list/',
  reports: '/report/list/',
  alertLogs: '/alert/:alertId/log/',
  reportLogs: '/report/:alertId/log/',
};
const frontEndRoutes = Object.values(routes).reduce(
  (acc, curr) => ({
    ...acc,
    [curr]: true,
  }),
  {},
);
const App = () => (
  <ReduxProvider store={store}>
    <ThemeProvider theme={theme}>
      <FlashProvider common={common}>
        <Router>
          <DynamicPluginProvider>
            <QueryParamProvider
              ReactRouterRoute={Route}
              stringifyOptions={{ encode: false }}
            >
              <Menu data={menu} frontEndRoutes={frontEndRoutes} />
              <Suspense fallback={<Loading />}>
                <Switch>
                  <Route path={routes.welcome}>
                    <ErrorBoundary>
                      <Welcome user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.dashboards}>
                    <ErrorBoundary>
                      <DashboardList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.charts}>
                    <ErrorBoundary>
                      <ChartList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.datasets}>
                    <ErrorBoundary>
                      <DatasetList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.databases}>
                    <ErrorBoundary>
                      <DatabaseList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.savedQueries}>
                    <ErrorBoundary>
                      <SavedQueryList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.cssTemplates}>
                    <ErrorBoundary>
                      <CssTemplatesList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.annotationLayers}>
                    <ErrorBoundary>
                      <AnnotationLayersList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.annotations}>
                    <ErrorBoundary>
                      <AnnotationList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.queries}>
                    <ErrorBoundary>
                      <QueryList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.alerts}>
                    <ErrorBoundary>
                      <AlertList user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.reports}>
                    <ErrorBoundary>
                      <AlertList user={user} isReportEnabled />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.alertLogs}>
                    <ErrorBoundary>
                      <ExecutionLog user={user} />
                    </ErrorBoundary>
                  </Route>
                  <Route path={routes.reportLogs}>
                    <ErrorBoundary>
                      <ExecutionLog user={user} isReportEnabled />
                    </ErrorBoundary>
                  </Route>
                </Switch>
              </Suspense>
              <ToastPresenter />
            </QueryParamProvider>
          </DynamicPluginProvider>
        </Router>
      </FlashProvider>
    </ThemeProvider>
  </ReduxProvider>
);

export default hot(App);
