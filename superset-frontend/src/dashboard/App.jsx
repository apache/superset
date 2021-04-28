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
import { hot } from 'react-hot-loader/root';
import React from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@superset-ui/core';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DynamicPluginProvider } from 'src/components/DynamicPlugins';
import setupApp from '../setup/setupApp';
import setupPlugins from '../setup/setupPlugins';
import DashboardPage from './containers/DashboardPage';
import { theme } from '../preamble';

setupApp();
setupPlugins();

const App = ({ store }) => {
  const dashboardIdOrSlug = window.location.pathname.split('/')[3];
  return (
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <ThemeProvider theme={theme}>
          <DynamicPluginProvider>
            <DashboardPage
              store={store}
              dashboardIdOrSlug={dashboardIdOrSlug}
            />
          </DynamicPluginProvider>
        </ThemeProvider>
      </DndProvider>
    </Provider>
  );
};

export default hot(App);
