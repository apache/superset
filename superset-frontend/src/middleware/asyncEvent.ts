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
import { Middleware, MiddlewareAPI, Dispatch } from 'redux';
import { SupersetClient } from '@superset-ui/core';
import { SupersetError } from 'src/components/ErrorMessage/types';
import { isFeatureEnabled, FeatureFlag } from '../featureFlags';
import {
  getClientErrorObject,
  parseErrorJson,
} from '../utils/getClientErrorObject';

type AsyncEventOptions = {
  getPendingComponents: (state: any) => any[];
  successAction: (componentId: number, componentData: any) => { type: string };
  errorAction: (componentId: number, response: any) => { type: string };
};

export type AsyncEvent = {
  id: string;
  channel_id: string;
  job_id: string;
  user_id: string;
  status: string;
  errors: SupersetError[];
  result_url: string;
};

type CachedDataResponse = {
  componentId: number;
  status: string;
  data: any;
};

const initAsyncEvents = (options: AsyncEventOptions) => {
  const POLLING_DELAY = 500;
  const { getPendingComponents, successAction, errorAction } = options;

  const middleware: Middleware = <S>(store: MiddlewareAPI<S>) => (
    next: Dispatch<S>,
  ) => {
    const JOB_STATUS = {
      PENDING: 'pending',
      RUNNING: 'running',
      ERROR: 'error',
      DONE: 'done',
    };
    const LOCALSTORAGE_KEY = 'last_async_event_id';
    const pollingUrl = '/api/v1/async_event/';
    let lastReceivedEventId: string | null;

    try {
      lastReceivedEventId = localStorage.getItem(LOCALSTORAGE_KEY);
    } catch (err) {
      console.warn('failed to fetch last event Id from localStorage');
    }

    const fetchEvents = async (
      lastEventId: string | null,
    ): Promise<AsyncEvent[]> => {
      const url = lastEventId
        ? `${pollingUrl}?last_id=${lastEventId}`
        : pollingUrl;
      const response = await fetch(url);

      if (!response.ok) {
        const message = `An error has occured: ${response.status}`;
        throw new Error(message);
      }

      const data = await response.json();
      return data.result;
    };

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
        data = 'result' in json ? json.result[0] : json;
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
        console.warn('Error saving event ID to localStorage', err);
      }
    };

    const processEvents = async () => {
      const state = store.getState();
      const queuedComponents = getPendingComponents(state);
      if (queuedComponents.length) {
        try {
          const events = await fetchEvents(lastReceivedEventId);
          if (!events || !events.length) {
            return setTimeout(processEvents, POLLING_DELAY);
          }
          const componentsByJobId = queuedComponents.reduce((acc, item) => {
            acc[item.asyncJobId] = item;
            return acc;
          }, {});
          const fetchDataEvents: Promise<CachedDataResponse>[] = [];
          events.forEach((asyncEvent: AsyncEvent) => {
            const component = componentsByJobId[asyncEvent.job_id];
            if (!component) {
              console.warn('component not found for job_id', asyncEvent.job_id);
              return false;
            }
            const componentId = component.id;
            switch (asyncEvent.status) {
              case JOB_STATUS.DONE:
                fetchDataEvents.push(fetchCachedData(asyncEvent, componentId));
                break;
              case JOB_STATUS.ERROR:
                store.dispatch(
                  errorAction(componentId, parseErrorJson(asyncEvent)),
                );
                break;
              default:
                console.warn('received event with status', asyncEvent.status);
            }

            return setLastId(asyncEvent);
          });

          const fetchResults = await Promise.all(fetchDataEvents);
          fetchResults.forEach(result => {
            if (result.status === 'success') {
              store.dispatch(successAction(result.componentId, result.data));
            } else {
              store.dispatch(errorAction(result.componentId, result.data));
            }
          });
        } catch (err) {
          console.error(err);
        }
      }

      return setTimeout(processEvents, POLLING_DELAY);
    };

    if (isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) processEvents();

    return action => next(action);
  };

  return middleware;
};

export default initAsyncEvents;
