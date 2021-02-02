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
import { Dispatch, Middleware, MiddlewareAPI } from 'redux';
import { makeApi, SupersetClient } from '@superset-ui/core';
import { SupersetError } from 'src/components/ErrorMessage/types';
import { FeatureFlag, isFeatureEnabled } from '../featureFlags';
import {
  getClientErrorObject,
  parseErrorJson,
} from '../utils/getClientErrorObject';

export type AsyncEvent = {
  id: string;
  channel_id: string;
  job_id: string;
  user_id?: string;
  status: string;
  errors?: SupersetError[];
  result_url: string;
};

type AsyncEventOptions = {
  config: {
    GLOBAL_ASYNC_QUERIES_TRANSPORT: string;
    GLOBAL_ASYNC_QUERIES_POLLING_DELAY: number;
    GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL: string;
  };
  getPendingComponents: (state: any) => any[];
  successAction: (componentId: number, componentData: any) => { type: string };
  errorAction: (componentId: number, response: any) => { type: string };
  processEventsCallback?: (events: AsyncEvent[]) => void; // this is currently used only for tests
};

type CachedDataResponse = {
  componentId: number;
  status: string;
  data: any;
};

const initAsyncEvents = (options: AsyncEventOptions) => {
  const TRANSPORT_POLLING = 'polling';
  const TRANSPORT_WS = 'ws';
  const {
    config,
    getPendingComponents,
    successAction,
    errorAction,
    processEventsCallback,
  } = options;
  const transport = config.GLOBAL_ASYNC_QUERIES_TRANSPORT || TRANSPORT_POLLING;
  const polling_delay = config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY || 500;

  const middleware: Middleware = (store: MiddlewareAPI) => (next: Dispatch) => {
    const JOB_STATUS = {
      PENDING: 'pending',
      RUNNING: 'running',
      ERROR: 'error',
      DONE: 'done',
    };
    const LOCALSTORAGE_KEY = 'last_async_event_id';
    const POLLING_URL = '/api/v1/async_event/';
    let lastReceivedEventId: string | null = null;

    try {
      lastReceivedEventId = localStorage.getItem(LOCALSTORAGE_KEY);
    } catch (err) {
      console.warn('Failed to fetch last event Id from localStorage');
    }

    const fetchEvents = makeApi<
      { last_id?: string | null },
      { result: AsyncEvent[] }
    >({
      method: 'GET',
      endpoint: POLLING_URL,
    });

    const fetchCachedData = async (
      asyncEvent: AsyncEvent,
      componentId: number,
    ): Promise<CachedDataResponse> => {
      let status = 'success';
      let data;
      try {
        const { json } = await SupersetClient.get({
          endpoint: asyncEvent.result_url,
        });
        data = 'result' in json ? json.result : json;
      } catch (response) {
        status = 'error';
        data = await getClientErrorObject(response);
      }

      return { componentId, status, data };
    };

    const setLastId = (asyncEvent: AsyncEvent) => {
      lastReceivedEventId = asyncEvent.id;
      try {
        localStorage.setItem(LOCALSTORAGE_KEY, lastReceivedEventId as string);
      } catch (err) {
        console.warn('Error saving event Id to localStorage', err);
      }
    };

    const componentsByJobId = (queuedComponents: any[], asyncJobId: string) => (
      queuedComponents.reduce((acc, item) => {
        acc[item.asyncJobId] = item;
        return acc;
      }, {})[asyncJobId]
    );

    const loadEvents = async () => {
      const queuedComponents = getPendingComponents(store.getState());
      const eventArgs = lastReceivedEventId
        ? { last_id: lastReceivedEventId }
        : {};
      const events: AsyncEvent[] = [];
      if (queuedComponents && queuedComponents.length) {
        try {
          const { result: events } = await fetchEvents(eventArgs);
          if (events && events.length) await processEvents(events);
        } catch (err) {
          console.warn(err);
        }
      }

      if (processEventsCallback) processEventsCallback(events);

      return setTimeout(loadEvents, polling_delay);
    };

    const processEvents = async (events: AsyncEvent[]) => {
      // refetch queuedComponents due to race condition where results are 
      // available before component state is updated with asyncJobId
      const queuedComponents = getPendingComponents(store.getState());
      const fetchDataEvents: Promise<CachedDataResponse>[] = [];
      events.forEach((asyncEvent: AsyncEvent) => {
        const component = componentsByJobId(queuedComponents, asyncEvent.job_id);
        if (!component) {
          console.warn(
            'component not found for job_id',
            asyncEvent.job_id,
          );
          return setLastId(asyncEvent);
        }
        const componentId = component.id;
        switch (asyncEvent.status) {
          case JOB_STATUS.DONE:
            fetchDataEvents.push(
              fetchCachedData(asyncEvent, componentId),
            );
            break;
          case JOB_STATUS.ERROR:
            store.dispatch(
              errorAction(componentId, [parseErrorJson(asyncEvent)]),
            );
            break;
          default:
            console.warn('received event with status', asyncEvent.status);
        }

        return setLastId(asyncEvent);
      });

      const fetchResults = await Promise.all(fetchDataEvents);
      fetchResults.forEach(result => {
        const data = Array.isArray(result.data)
          ? result.data
          : [result.data];
        if (result.status === 'success') {
          store.dispatch(successAction(result.componentId, data));
        } else {
          store.dispatch(errorAction(result.componentId, data));
        }
      });
    }

    const wsConnectMaxRetries: number = 6;
    const wsConnectErrorDelay: number = 2500;
    let wsConnectRetries: number = 0;
    let wsConnectTimeout: any;
    let ws: WebSocket;

    const wsConnect = (): void => {
      let url = config.GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL;
      if (lastReceivedEventId) url += `?last_id=${lastReceivedEventId}`;
      ws = new WebSocket(url);

      ws.addEventListener('open', (event) => {
        console.log('WebSocket connected');
        clearTimeout(wsConnectTimeout);
        wsConnectRetries = 0;
      });

      ws.addEventListener('close', (event) => {
        console.log('The WebSocket connection has been closed');
        wsConnectTimeout = setTimeout(() => {
          if (++wsConnectRetries <= wsConnectMaxRetries) {
            wsConnect();
          } else {
            console.warn("WebSocket not available, falling back to async polling");
            loadEvents();
          }
        }, wsConnectErrorDelay);
      });

      ws.addEventListener('error', (event) => {
        console.log('WebSocket error', event);
        // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
        if(ws.readyState < 2) ws.close();
      });

      ws.addEventListener('message', async (event) => {
        let events: AsyncEvent[] = [];
        try {
          events = [JSON.parse(event.data)];
          await processEvents(events);
        } catch(err) {
          console.warn(err);
        }
        if (processEventsCallback) processEventsCallback(events);
      });
    }

    if (isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) {
      if (transport === TRANSPORT_POLLING) {
        loadEvents();
      }
      if (transport === TRANSPORT_WS) {
        wsConnect();
      }
    }

    return action => next(action);
  };

  return middleware;
};

export default initAsyncEvents;
