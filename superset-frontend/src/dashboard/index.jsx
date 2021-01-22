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
import ReactDOM from 'react-dom';
import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose } from 'redux';
import { initFeatureFlags } from 'src/featureFlags';
import { initEnhancer } from '../reduxUtils';
import getInitialState from './reducers/getInitialState';
import rootReducer from './reducers/index';
import initAsyncEvents from '../middleware/asyncEvent';
import logger from '../middleware/loggerMiddleware';
import * as actions from '../chart/chartAction';

import App from './App';

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
initFeatureFlags(bootstrapData.common.feature_flags);
const initState = getInitialState(bootstrapData);

const asyncEventMiddleware = initAsyncEvents({
  config: bootstrapData.common.conf,
  getPendingComponents: ({ charts }) =>
    Object.values(charts).filter(c => c.chartStatus === 'loading'),
  successAction: (componentId, componentData) =>
    actions.chartUpdateSucceeded(componentData, componentId),
  errorAction: (componentId, response) =>
    actions.chartUpdateFailed(response, componentId),
});

const store = createStore(
  rootReducer,
  initState,
  compose(
    applyMiddleware(thunk, logger, asyncEventMiddleware),
    initEnhancer(false),
  ),
);

ReactDOM.render(<App store={store} />, document.getElementById('app'));
