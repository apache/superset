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
import { Provider } from 'react-redux';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ThemeProvider } from '@superset-ui/core';
import { GlobalStyles } from 'src/GlobalStyles';
import { DynamicPluginProvider } from 'src/components/DynamicPlugins';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import setupApp from 'src/setup/setupApp';
import setupPlugins from 'src/setup/setupPlugins';
import './main.less';
import '../assets/stylesheets/reactable-pagination.less';
import { theme } from 'src/preamble';
import ExploreViewContainer from './components/ExploreViewContainer';

setupApp();
setupPlugins();

const App = ({ store }) => (
  <Provider store={store}>
    <DndProvider backend={HTML5Backend}>
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <DynamicPluginProvider>
          <ExploreViewContainer />
          <ToastContainer />
        </DynamicPluginProvider>
      </ThemeProvider>
    </DndProvider>
  </Provider>
);

export default hot(App);
