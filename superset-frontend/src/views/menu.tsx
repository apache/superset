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
import React from 'react';
import ReactDOM from 'react-dom';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { ThemeProvider } from '@superset-ui/core';
import Menu from 'src/views/components/Menu';
import { theme } from 'src/preamble';

import { Provider } from 'react-redux';
import { store } from './store';

const container = document.getElementById('app');
const bootstrapJson = container?.getAttribute('data-bootstrap') ?? '{}';
const bootstrap = JSON.parse(bootstrapJson);
const menu = { ...bootstrap.common.menu_data };

const emotionCache = createCache({
  key: 'menu',
});

const app = (
  // @ts-ignore: emotion types defs are incompatible between core and cache
  <CacheProvider value={emotionCache}>
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <Menu data={menu} />
      </Provider>
    </ThemeProvider>
  </CacheProvider>
);

ReactDOM.render(app, document.getElementById('app-menu'));
