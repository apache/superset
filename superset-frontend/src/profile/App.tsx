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
import { ThemeProvider } from '@superset-ui/core';
import App from 'src/profile/components/App';
import messageToastReducer from 'src/messageToasts/reducers';
import { initEnhancer } from 'src/reduxUtils';
import setupApp from 'src/setup/setupApp';
import './main.less';
import { theme } from 'src/preamble';
import ToastPresenter from 'src/messageToasts/containers/ToastPresenter';

setupApp();

const profileViewContainer = document.getElementById('app');
const bootstrap = JSON.parse(
  profileViewContainer?.getAttribute('data-bootstrap') ?? '{}',
);

const store = createStore(
  combineReducers({
    messageToasts: messageToastReducer,
  }),
  {},
  compose(applyMiddleware(thunk), initEnhancer(false)),
);

const Application = () => (
  <Provider store={store}>
    <ThemeProvider theme={theme}>
      <App user={bootstrap.user} />
      <ToastPresenter />
    </ThemeProvider>
  </Provider>
);

export default hot(Application);
