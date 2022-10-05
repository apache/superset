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
import React, { Suspense, useEffect } from 'react';
import { hot } from 'react-hot-loader/root';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  useLocation,
} from 'react-router-dom';
import { GlobalStyles } from 'src/GlobalStyles';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Loading from 'src/components/Loading';
import Menu from 'src/views/components/Menu';
import { bootstrapData } from 'src/preamble';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import setupApp from 'src/setup/setupApp';
import setupPlugins from 'src/setup/setupPlugins';
import { routes, isFrontendRoute } from 'src/views/routes';
import { Logger } from 'src/logger/LogUtils';
import setupExtensions from 'src/setup/setupExtensions';
import { RootContextProviders } from './RootContextProviders';
import { ScrollToTop } from './ScrollToTop';
import QueryProvider from './QueryProvider';

setupApp();
setupPlugins();
setupExtensions();

const user = { ...bootstrapData.user };
const menu = {
  ...bootstrapData.common.menu_data,
};
let lastLocationPathname: string;

const LocationPathnameLogger = () => {
  const location = useLocation();
  useEffect(() => {
    // reset performance logger timer start point to avoid soft navigation
    // cause dashboard perf measurement problem
    if (lastLocationPathname && lastLocationPathname !== location.pathname) {
      Logger.markTimeOrigin();
    }
    lastLocationPathname = location.pathname;
  }, [location.pathname]);
  return <></>;
};

const App = () => (
  <QueryProvider>
    <Router>
      <ScrollToTop />
      <LocationPathnameLogger />
      <RootContextProviders>
        <GlobalStyles />
        <Menu data={menu} isFrontendRoute={isFrontendRoute} />
        <Switch>
          {routes.map(({ path, Component, props = {}, Fallback = Loading }) => (
            <Route path={path} key={path}>
              <Suspense fallback={<Fallback />}>
                <ErrorBoundary>
                  <Component user={user} {...props} />
                </ErrorBoundary>
              </Suspense>
            </Route>
          ))}
        </Switch>
        <ToastContainer />
      </RootContextProviders>
    </Router>
  </QueryProvider>
);

export default hot(App);
