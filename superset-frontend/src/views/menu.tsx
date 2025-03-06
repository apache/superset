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

// Menu App. Used in views that do not already include the Menu component in the layout.
// eg, backend rendered views
import { Provider } from 'react-redux';
import ReactDOM from 'react-dom';
import { Route, BrowserRouter } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import { QueryParamProvider } from 'use-query-params';
import createCache from '@emotion/cache';
import { ThemeProvider } from '@superset-ui/core';
import Menu from 'src/features/home/Menu';
import { theme } from 'src/preamble';
import { AntdThemeProvider } from 'src/components/AntdThemeProvider';
import getBootstrapData from 'src/utils/getBootstrapData';
import { setupStore } from './store';

// Disable connecting to redux debugger so that the React app injected
// Below the menu like SqlLab or Explore can connect its redux store to the debugger
const store = setupStore({ disableDebugger: true });
const bootstrapData = getBootstrapData();
const menu = { ...bootstrapData.common.menu_data };

const emotionCache = createCache({
  key: 'menu',
});

const app = (
  // @ts-ignore: emotion types defs are incompatible between core and cache
  <CacheProvider value={emotionCache}>
    <ThemeProvider theme={theme}>
      <AntdThemeProvider>
        <Provider store={store}>
          <BrowserRouter>
            <QueryParamProvider
              ReactRouterRoute={Route}
              stringifyOptions={{ encode: false }}
            >
              <Menu data={menu} />
            </QueryParamProvider>
          </BrowserRouter>
        </Provider>
      </AntdThemeProvider>
    </ThemeProvider>
  </CacheProvider>
);

ReactDOM.render(app, document.getElementById('app-menu'));
