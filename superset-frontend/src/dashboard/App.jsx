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
import { supersetTheme, ThemeProvider } from '@superset-ui/core';

import { DynamicPluginProvider } from 'src/components/DynamicPlugins';
import setupApp from '../setup/setupApp';
import setupPlugins from '../setup/setupPlugins';
import DashboardContainer from './containers/Dashboard';

setupApp();
setupPlugins();

const App = ({ store }) => (
  <Provider store={store}>
    <ThemeProvider theme={supersetTheme}>
      <DynamicPluginProvider>
        <DashboardContainer />
      </DynamicPluginProvider>
    </ThemeProvider>
  </Provider>
);

export default hot(App);
