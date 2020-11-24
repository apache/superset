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
import { get, some } from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose } from 'redux';
import { initFeatureFlags } from 'src/featureFlags';
import { initEnhancer } from '../reduxUtils';
import getInitialState from './reducers/getInitialState';
import rootReducer from './reducers/index';
import logger from '../middleware/loggerMiddleware';


// TODO: move/abstract this
import * as actions from '../chart/chartAction';
import asyncEventReceived from './reducers/asyncEvents';


import App from './App';
// TODO: re-enable
// import { catch } from 'fetch-mock';

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
initFeatureFlags(bootstrapData.common.feature_flags);
const initState = getInitialState(bootstrapData);


// TODO: move/abstract this
const asyncEventMiddleware = store => next => {
  const pollingUrl = '/api/v1/async_event/';
  const isLoading = (state) => some(state.charts, {chartStatus: "queued"});  // pass this in

  const fetchEvents = async (lastEventId) => {
    const url = lastEventId ? `${pollingUrl}?last_id=${lastEventId}` : pollingUrl;
    const response = await fetch(url);

      if (!response.ok) {
        const message = `An error has occured: ${response.status}`;
        throw new Error(message);
      }

      const data = await response.json();
      return data.result;
  }

  const fetchData = async (asyncEvent) => {
    const dataUrl = `/api/v1/chart/data/${asyncEvent.cache_key}`; // TODO: determine from event type
    const response = await fetch(dataUrl);

      if (!response.ok) {
        const message = `An error has occured: ${response.status}`;
        throw new Error(message);
      }

      const data = await response.json();
      return data.result[0];
  }

  const updateMessages = async () => {
    if (isLoading(store.getState())) {
      console.log('************* fetching events');
      try {
        const state = store.getState();
        const lastEventId = get(state, 'asyncEvents.last_event_id');
        console.log('********** lastEventId', lastEventId);
        const events = await fetchEvents(lastEventId);

        // TODO: how to tie this event back to the caller component (by key?)
        console.log('async events received', events);

        // iterate over queued charts
        const componentsInState = store.getState()['charts']; // TODO: pass key into middleware init
        const queuedComponents = _.filter(componentsInState, {chartStatus: "queued"}) // TODO: pass in
        const componentsByJobId = queuedComponents.reduce((acc, item) => {
          acc[item['asyncJobId']] = item;
          return acc;
        }, {});

        console.log('componentsByJobId', componentsByJobId);

        for (const asyncEvent of events) {
          console.log('async event', asyncEvent);
          console.log('job id', asyncEvent['job_id']);
          const component = componentsByJobId[asyncEvent['job_id']];
          if (component) {
            const key = component['id'];
            const componentData = await fetchData(asyncEvent);
            console.log('************* dispatch', key, componentData);
            store.dispatch(actions.chartUpdateSucceeded(componentData, key));
          }
          // console.log('asyncEventReceived', asyncEventReceived);
          store.dispatch({ type: 'ASYNC_EVENT_RECEIVED', eventId: asyncEvent['id'] });
          // store.dispatch(asyncEventReceived(asyncEvent['id']));
        }
      } catch (err) {
        // console.error(err.message);
        throw err;
      }
    } else {
      console.log('********** no components waiting for data');
    }

    setTimeout(updateMessages, 500);
  };

  updateMessages();

  return action => next(action);
};

const store = createStore(
  rootReducer,
  initState,
  compose(applyMiddleware(thunk, logger, asyncEventMiddleware), initEnhancer(false)),
);

ReactDOM.render(<App store={store} />, document.getElementById('app'));
