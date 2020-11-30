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
import { some } from 'lodash';
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
import { SupersetClient } from '@superset-ui/core';
import * as actions from '../chart/chartAction';
import { getClientErrorObject, parseErrorJson } from '../utils/getClientErrorObject';


import App from './App';
// TODO: re-enable
// import { catch } from 'fetch-mock';

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
initFeatureFlags(bootstrapData.common.feature_flags);
const initState = getInitialState(bootstrapData);


// TODO: move/abstract this
const asyncEventMiddleware = store => next => {
  const JOB_STATUS = {
    PENDING: "pending",
    RUNNING: "running",
    ERROR: "error",
    DONE: "done",
  }
  const LOCALSTORAGE_KEY = 'last_async_event_id';
  const pollingUrl = '/api/v1/async_event/';
  const isLoading = (state) => some(state.charts, {chartStatus: 'loading'});  // TODO: pass this in

  let lastReceivedEventId;
  try {
    lastReceivedEventId = localStorage.getItem(LOCALSTORAGE_KEY);
    console.log('************ loaded last ID from localStorage', lastReceivedEventId);
  } catch(err) {
    console.warn("failed to fetch last event Id from localStorage");
  }

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

  const fetchCachedData = async (asyncEvent) => {
    return SupersetClient.get({
      endpoint: asyncEvent['result_url'],
    })
    .then(({ json }) => {
      const result = ('result' in json) ? json.result[0] : json;
      return result;
    });
  }

  const processEvents = async () => {
    if (isLoading(store.getState())) {
      console.log('************* fetching events');
      try {
        const events = await fetchEvents(lastReceivedEventId);
        console.log('******* async events received', events);

        // iterate over queued charts
        const componentsInState = store.getState()['charts']; // TODO: pass key into middleware init
        const queuedComponents = _.filter(componentsInState, {chartStatus: "loading"}) // TODO: pass in
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
            switch(asyncEvent['status']) {
              case JOB_STATUS.DONE:
                try {
                  const componentData = await fetchCachedData(asyncEvent);
                  console.log('************* success dispatch', key, componentData);
                  store.dispatch(actions.chartUpdateSucceeded(componentData, key));   // TODO: abstract
                } catch(errorResponse) {
                  console.log('*************** error loading data from cache', errorResponse);
                  getClientErrorObject(errorResponse).then(parsedResponse => {
                    console.log('************* failed dispatch', key, parsedResponse);
                    store.dispatch(actions.chartUpdateFailed(parsedResponse, key));   // TODO: abstract
                  });
                }
                break;
              case JOB_STATUS.ERROR:
                console.log('************ error event received');
                const parsedEvent = parseErrorJson(asyncEvent);
                console.log('************* parsedErrorEvent', parsedEvent);
                store.dispatch(actions.chartUpdateFailed(parsedEvent, key));   // TODO: abstract
                break;
            }
          } else {
            console.log('component not found for job_id', asyncEvent['job_id']);
          }
          lastReceivedEventId = asyncEvent['id'];
          try {
            localStorage.setItem(LOCALSTORAGE_KEY, asyncEvent['id']);
          } catch (err) {
            console.warn('Localstorage not enabled');
          }
        }
      } catch (err) {
        throw err;
      }
    } else {
      console.log('********** no components waiting for data');
    }

    setTimeout(processEvents, 500);
  };

  // TODO: call only if feature flag is enabled
  processEvents();

  return action => next(action);
};

const store = createStore(
  rootReducer,
  initState,
  compose(applyMiddleware(thunk, logger, asyncEventMiddleware), initEnhancer(false)),
);

ReactDOM.render(<App store={store} />, document.getElementById('app'));
