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
import { hot } from 'react-hot-loader';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

import { initFeatureFlags } from 'src/featureFlags';
import { initEnhancer } from '../reduxUtils';
import logger from '../middleware/loggerMiddleware';
import ToastPresenter from '../messageToasts/containers/ToastPresenter';
import ExploreViewContainer from './components/ExploreViewContainer';
import getInitialState from './reducers/getInitialState';
import rootReducer from './reducers/index';

import setupApp from '../setup/setupApp';
import setupPlugins from '../setup/setupPlugins';
import './main.css';
import '../../stylesheets/reactable-pagination.css';

setupApp();
setupPlugins();

const exploreViewContainer = document.getElementById('app');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));
initFeatureFlags(bootstrapData.common.feature_flags);
const initState = getInitialState(bootstrapData);

const store = createStore(
  rootReducer,
  initState,
  compose(
    applyMiddleware(thunk, logger),
    initEnhancer(false),
  ),
);

const App = () => (
  <Provider store={store}>
    <div>
      <ExploreViewContainer />
      <ToastPresenter />
    </div>
  </Provider>
);

export default hot(module)(App);
