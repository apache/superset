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
import {
  ensureIsArray,
  makeApi,
  SupersetClient,
  logging,
} from '@superset-ui/core';
import { SupersetError } from 'src/components/ErrorMessage/types';
import { FeatureFlag, isFeatureEnabled } from '../featureFlags';
import {
  getClientErrorObject,
  parseErrorJson,
} from '../utils/getClientErrorObject';

type AsyncEvent = {
  id?: string | null;
  channel_id: string;
  job_id: string;
  user_id?: string;
  status: string;
  errors?: SupersetError[];
  result_url: string | null;
};

type CachedDataResponse = {
  status: string;
  data: any;
};
type AppConfig = Record<string, any>;
type ListenerFn = (asyncEvent: AsyncEvent) => Promise<any>;

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

let config: AppConfig;
let transport: string;
let pollingDelayMs: number;
let pollingTimeoutId: number;
let listenersByJobId: Record<string, ListenerFn>;
let retriesByJobId: Record<string, number>;
let lastReceivedEventId: string | null | undefined;

export const init = (appConfig?: AppConfig) => {
  if (!isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) return;
  if (pollingTimeoutId) clearTimeout(pollingTimeoutId);

  listenersByJobId = {};
  retriesByJobId = {};
  lastReceivedEventId = null;

  if (appConfig) {
    config = appConfig;
  } else {
    // load bootstrap data from DOM
    const appContainer = document.getElementById('app');
    if (appContainer) {
      const bootstrapData = JSON.parse(
        appContainer?.getAttribute('data-bootstrap') || '{}',
      );
      config = bootstrapData?.common?.conf;
    } else {
      config = {};
      logging.warn('asyncEvent: app config data not found');
    }
  }
  transport = config.GLOBAL_ASYNC_QUERIES_TRANSPORT || TRANSPORT_POLLING;
  pollingDelayMs = config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY || 500;

  try {
    lastReceivedEventId = localStorage.getItem(LOCALSTORAGE_KEY);
  } catch (err) {
    logging.warn('Failed to fetch last event Id from localStorage');
  }

  if (transport === TRANSPORT_POLLING) {
    loadEventsFromApi();
  }
  if (transport === TRANSPORT_WS) {
    wsConnect();
  }
};

const addListener = (id: string, fn: any) => {
  listenersByJobId[id] = fn;
};

const removeListener = (id: string) => {
  if (!listenersByJobId[id]) return;
  delete listenersByJobId[id];
};

export const waitForAsyncData = async (asyncResponse: AsyncEvent) =>
  new Promise((resolve, reject) => {
    const jobId = asyncResponse.job_id;
    const listener = async (asyncEvent: AsyncEvent) => {
      switch (asyncEvent.status) {
        case JOB_STATUS.DONE: {
          let { data, status } = await fetchCachedData(asyncEvent); // eslint-disable-line prefer-const
          data = ensureIsArray(data);
          if (status === 'success') {
            resolve(data);
          } else {
            reject(data);
          }
          break;
        }
        case JOB_STATUS.ERROR: {
          const err = parseErrorJson(asyncEvent);
          reject(err);
          break;
        }
        default: {
          logging.warn('received event with status', asyncEvent.status);
        }
      }
      removeListener(jobId);
    };
    addListener(jobId, listener);
  });

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
      endpoint: String(asyncEvent.result_url),
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
    logging.warn('Error saving event Id to localStorage', err);
  }
};

const loadEventsFromApi = async () => {
  const eventArgs = lastReceivedEventId ? { last_id: lastReceivedEventId } : {};
  if (Object.keys(listenersByJobId).length) {
    try {
      const { result: events } = await fetchEvents(eventArgs);
      if (events && events.length) await processEvents(events);
    } catch (err) {
      logging.warn(err);
    }
  }

  if (transport === TRANSPORT_POLLING) {
    pollingTimeoutId = window.setTimeout(loadEventsFromApi, pollingDelayMs);
  }
};

export const processEvents = async (events: AsyncEvent[]) => {
  events.forEach((asyncEvent: AsyncEvent) => {
    const jobId = asyncEvent.job_id;
    const listener = listenersByJobId[jobId];
    if (listener) {
      listener(asyncEvent);
      delete retriesByJobId[jobId];
    } else {
      // handle race condition where event is received
      // before listener is registered
      if (!retriesByJobId[jobId]) retriesByJobId[jobId] = 0;
      retriesByJobId[jobId] += 1;

      if (retriesByJobId[jobId] <= MAX_RETRIES) {
        setTimeout(() => {
          processEvents([asyncEvent]);
        }, RETRY_DELAY * retriesByJobId[jobId]);
      } else {
        delete retriesByJobId[jobId];
        logging.warn('listener not found for job_id', asyncEvent.job_id);
      }
    }
    setLastId(asyncEvent);
  });
};

const wsConnectMaxRetries = 6;
const wsConnectErrorDelay = 2500;
let wsConnectRetries = 0;
let wsConnectTimeout: any;
let ws: WebSocket;

const wsConnect = (): void => {
  let url = config.GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL;
  if (lastReceivedEventId) url += `?last_id=${lastReceivedEventId}`;
  ws = new WebSocket(url);

  ws.addEventListener('open', event => {
    logging.log('WebSocket connected');
    clearTimeout(wsConnectTimeout);
    wsConnectRetries = 0;
  });

  ws.addEventListener('close', event => {
    wsConnectTimeout = setTimeout(() => {
      wsConnectRetries += 1;
      if (wsConnectRetries <= wsConnectMaxRetries) {
        wsConnect();
      } else {
        logging.warn('WebSocket not available, falling back to async polling');
        loadEventsFromApi();
      }
    }, wsConnectErrorDelay);
  });

  ws.addEventListener('error', event => {
    // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
    if (ws.readyState < 2) ws.close();
  });

  ws.addEventListener('message', async event => {
    let events: AsyncEvent[] = [];
    try {
      events = [JSON.parse(event.data)];
      await processEvents(events);
    } catch (err) {
      logging.warn(err);
    }
  });
};

init();
