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
  isFeatureEnabled,
  FeatureFlag,
  makeApi,
  SupersetClient,
  getClientErrorObject,
  parseErrorJson,
  SupersetError,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';

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
// Cap for the exponential backoff applied when polling requests fail
// repeatedly (e.g. expired session, server or network errors)
const MAX_ERROR_POLLING_DELAY_MS = 60000;

let config: AppConfig;
let transport: string;
let pollingDelayMs: number;
let pollingTimeoutId: number;
let listenersByJobId: Map<string, ListenerFn>;
let retriesByJobId: Map<string, number>;
let lastReceivedEventId: string | null | undefined;
let consecutivePollingErrorCount = 0;
// Incremented on every init() so polling invocations that are already
// awaiting a fetch when re-init happens can detect they are stale and
// stop, instead of mutating fresh state or scheduling a second loop
let pollingGeneration = 0;

const addListener = (id: string, fn: ListenerFn) => {
  listenersByJobId.set(id, fn);
};

const removeListener = (id: string) => {
  if (!listenersByJobId.has(id)) return;
  listenersByJobId.delete(id);
};

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

const setLastId = (asyncEvent: AsyncEvent) => {
  lastReceivedEventId = asyncEvent.id;
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, lastReceivedEventId as string);
  } catch (err) {
    logging.warn('Error saving event Id to localStorage', err);
  }
};

export const processEvents = async (events: AsyncEvent[]) => {
  events.forEach((asyncEvent: AsyncEvent) => {
    const jobId = asyncEvent.job_id;
    const listener = listenersByJobId.get(jobId);
    // `jobId` originates from server/WebSocket payloads, so the listener is
    // resolved exclusively through a Map (never plain-object property access,
    // which would expose the prototype chain), and we confirm the retrieved
    // value is a registered function before dispatching the event to it.
    if (typeof listener === 'function') {
      listener(asyncEvent);
      retriesByJobId.delete(jobId);
    } else {
      // handle race condition where event is received
      // before listener is registered
      const retries = (retriesByJobId.get(jobId) ?? 0) + 1;
      retriesByJobId.set(jobId, retries);

      if (retries <= MAX_RETRIES) {
        setTimeout(() => {
          processEvents([asyncEvent]);
        }, RETRY_DELAY * retries);
      } else {
        retriesByJobId.delete(jobId);
        logging.warn('listener not found for job_id', asyncEvent.job_id);
      }
    }
    setLastId(asyncEvent);
  });
};

const getPollingDelay = () => {
  if (!consecutivePollingErrorCount) return pollingDelayMs;
  const backoffDelayMs = pollingDelayMs * 2 ** consecutivePollingErrorCount;
  return Math.max(
    pollingDelayMs,
    Math.min(backoffDelayMs, MAX_ERROR_POLLING_DELAY_MS),
  );
};

const loadEventsFromApi = async () => {
  const generation = pollingGeneration;
  const eventArgs = lastReceivedEventId ? { last_id: lastReceivedEventId } : {};
  if (listenersByJobId.size) {
    try {
      const { result: events } = await fetchEvents(eventArgs);
      if (generation !== pollingGeneration) return;
      consecutivePollingErrorCount = 0;
      if (events?.length) await processEvents(events);
    } catch (err) {
      if (generation !== pollingGeneration) return;
      consecutivePollingErrorCount += 1;
      logging.warn(err);
    }
  }

  if (generation !== pollingGeneration) return;
  if (transport === TRANSPORT_POLLING) {
    pollingTimeoutId = window.setTimeout(loadEventsFromApi, getPollingDelay());
  }
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

  ws.addEventListener('open', () => {
    logging.log('WebSocket connected');
    clearTimeout(wsConnectTimeout);
    wsConnectRetries = 0;
  });

  ws.addEventListener('close', () => {
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

  ws.addEventListener('error', () => {
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

export const init = (appConfig?: AppConfig) => {
  pollingGeneration += 1;
  if (pollingTimeoutId) clearTimeout(pollingTimeoutId);
  if (!isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) return;

  listenersByJobId = new Map();
  retriesByJobId = new Map();
  lastReceivedEventId = null;
  consecutivePollingErrorCount = 0;

  config = appConfig || getBootstrapData().common.conf;
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

init();
