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

type CachedDataResponse = {
  status: string;
  data: any;
};

const TRANSPORT_POLLING = 'polling';
const TRANSPORT_WS = 'ws';
const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  ERROR: 'error',
  DONE: 'done',
};
const LOCALSTORAGE_KEY = 'last_async_event_id';
const POLLING_URL = '/api/v1/async_event/';
const MAX_RETRIES = 6;
const RETRY_DELAY = 100;

// load bootstrap data
const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer?.getAttribute('data-bootstrap') || '{}');
const config = bootstrapData.common.conf;

const transport = config.GLOBAL_ASYNC_QUERIES_TRANSPORT || TRANSPORT_POLLING;
const polling_delay = config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY || 500;
const listenersByJobId = {};
const retriesByJobId = {};
let lastReceivedEventId: string | null = null;

try {
  lastReceivedEventId = localStorage.getItem(LOCALSTORAGE_KEY);
} catch (err) {
  console.warn('Failed to fetch last event Id from localStorage');
}

const addListener = (id: string, fn: any) => {
  listenersByJobId[id] = fn;
  console.log('adding listener', id, fn);
}

const removeListener = (id: string) => {
  if(!listenersByJobId[id]) return;
  delete listenersByJobId[id];
}

export const waitForAsyncData = async (asyncResponse: AsyncEvent) => {
  return new Promise((resolve, reject) => {
    const jobId = asyncResponse.job_id;
    const listener = async (asyncEvent: AsyncEvent) => {
      switch (asyncEvent.status) {
        case JOB_STATUS.DONE:
          let { data, status } = await fetchCachedData(asyncEvent);
          data = Array.isArray(data) ? data : [data];
          if (status === 'success') {
            resolve(data);
          } else {
            reject(data);
          }
          break;
        case JOB_STATUS.ERROR:
          const err = parseErrorJson(asyncEvent);
          reject(err);
          break;
        default:
          console.warn('received event with status', asyncEvent.status);
      }
      removeListener(jobId);
    };
    addListener(jobId, listener);
  });
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

  return { status, data };
};

const setLastId = (asyncEvent: AsyncEvent) => {
  lastReceivedEventId = asyncEvent.id;
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, lastReceivedEventId as string);
  } catch (err) {
    console.warn('Error saving event Id to localStorage', err);
  }
};

const loadEventsFromApi = async () => {
  const eventArgs = lastReceivedEventId
    ? { last_id: lastReceivedEventId }
    : {};
  const events: AsyncEvent[] = [];
  if (Object.keys(listenersByJobId).length) {
    try {
      const { result: events } = await fetchEvents(eventArgs);
      if (events && events.length) await processEvents(events);
    } catch (err) {
      console.warn(err);
    }
  }

  // if (processEventsCallback) processEventsCallback(events);

  return setTimeout(loadEventsFromApi, polling_delay);
};

const processEvents = async (events: AsyncEvent[]) => {
  events.forEach((asyncEvent: AsyncEvent) => {
    console.log('event received', asyncEvent);
    const jobId = asyncEvent.job_id;
    const listener = listenersByJobId[jobId];
    if(listener) {
      listener(asyncEvent);
      delete retriesByJobId[jobId];
    } else {
      // handle race condition where event is received
      // before listener is registered
      if(!retriesByJobId[jobId]) retriesByJobId[jobId] = 0;
      retriesByJobId[jobId]++;

      if(retriesByJobId[jobId] <= MAX_RETRIES) {
        console.log('************************ RETRY', jobId, RETRY_DELAY*retriesByJobId[jobId]);
        setTimeout(() => {
          processEvents([asyncEvent]);
        }, RETRY_DELAY*retriesByJobId[jobId]);
      } else {
        delete retriesByJobId[jobId];
        console.warn(
          'listener not found for job_id',
          asyncEvent.job_id,
        );
      }
    }
    setLastId(asyncEvent);
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
  console.log('Connecting to websocket', url);
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
        loadEventsFromApi();
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
    // if (processEventsCallback) processEventsCallback(events);
  });
}

if (isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) {
  if (transport === TRANSPORT_POLLING) {
    loadEventsFromApi();
  }
  if (transport === TRANSPORT_WS) {
    wsConnect();
  }
}

// return { waitForAsyncData }
