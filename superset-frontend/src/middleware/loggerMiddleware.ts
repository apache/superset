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
/* eslint-disable camelcase */
/* eslint prefer-const: 2 */

import { Dispatch, Middleware, MiddlewareAPI, AnyAction } from 'redux';
import { nanoid } from 'nanoid';
import { SupersetClient } from '@superset-ui/core';

import { safeStringify } from '../utils/safeStringify';
import { LOG_EVENT } from '../logger/actions';
import {
  LOG_EVENT_TYPE_TIMING,
  LOG_ACTIONS_SPA_NAVIGATION,
} from '../logger/LogUtils';
import DebouncedMessageQueue from '../utils/DebouncedMessageQueue';
import { ensureAppRoot } from '../utils/pathUtils';
import type { RootState } from '../views/store';
import type { QueryEditor } from '../SqlLab/types';

// Types for log events
interface LogAction extends AnyAction {
  type: typeof LOG_EVENT;
  payload: {
    eventName: string;
    eventData?: Record<string, unknown>;
  };
}

interface LogEventData {
  impression_id?: string;
  version?: string;
  source?: 'dashboard' | 'explore' | 'sqlLab' | 'slice';
  source_id?: string | number;
  dashboard_id?: string | number;
  slice_id?: number;
  db_id?: number;
  schema?: string;
  ts: number;
  event_name: string;
  event_type: 'timing' | 'user';
  trigger_event?: string | number;
  event_id?: string;
  visibility?: DocumentVisibilityState;
  target_id?: string;
  target_name?: string;
  path?: string;
  [key: string]: unknown;
}

const LOG_ENDPOINT = '/superset/log/?explode=events';
const sendBeacon = (events: LogEventData[]): void => {
  if (events.length <= 0) {
    return;
  }

  let endpoint = LOG_ENDPOINT;
  const { source, source_id } = events[0];
  // backend logs treat these request params as first-class citizens
  if (source === 'dashboard') {
    endpoint += `&dashboard_id=${source_id}`;
  } else if (source === 'slice') {
    endpoint += `&slice_id=${source_id}`;
  }

  if (navigator.sendBeacon) {
    const formData = new FormData();
    formData.append('events', safeStringify(events));
    const guestToken = SupersetClient.getGuestToken();
    if (guestToken) {
      // if we have a guest token, we need to send it for auth via the form
      formData.append('guest_token', guestToken);
    }
    navigator.sendBeacon(ensureAppRoot(endpoint), formData);
  } else {
    SupersetClient.post({
      endpoint,
      postPayload: { events },
      parseMethod: null,
    });
  }
};

// beacon API has data size limit = 2^16.
// assume avg each log entry has 2^6 characters
const MAX_EVENTS_PER_REQUEST = 1024;
const logMessageQueue = new DebouncedMessageQueue<LogEventData>({
  callback: sendBeacon,
  sizeThreshold: MAX_EVENTS_PER_REQUEST,
  delayThreshold: 1000,
});
let lastEventId: string | number = 0;

const loggerMiddleware: Middleware<{}, RootState, Dispatch<AnyAction>> =
  (store: MiddlewareAPI<Dispatch<AnyAction>, RootState>) =>
  (next: Dispatch<AnyAction>) => {
    let navPath: string | undefined;
    return (action: AnyAction): unknown => {
      if (action.type !== LOG_EVENT) {
        return next(action);
      }

      const logAction = action as LogAction;
      const { dashboardInfo, explore, impressionId, dashboardLayout, sqlLab } =
        store.getState();
      let logMetadata: Partial<LogEventData> = {
        impression_id: impressionId,
        version: 'v2',
      };
      const { eventName } = logAction.payload;
      const { eventData = {} } = logAction.payload;

      if (eventName === LOG_ACTIONS_SPA_NAVIGATION) {
        navPath = eventData.path as string;
      }
      const path = navPath || window?.location?.href;

      if (dashboardInfo?.id && path?.includes('/dashboard/')) {
        logMetadata = {
          source: 'dashboard',
          source_id: dashboardInfo.id,
          dashboard_id: dashboardInfo.id,
          ...logMetadata,
        };
      } else if (explore?.slice) {
        logMetadata = {
          source: 'explore',
          source_id: explore.slice ? explore.slice.slice_id : 0,
          ...(explore.slice.slice_id && { slice_id: explore.slice.slice_id }),
          ...logMetadata,
        };
      } else if (path?.includes('/sqllab/')) {
        const editor = sqlLab.queryEditors.find(
          ({ id }: QueryEditor) => id === sqlLab.tabHistory.slice(-1)[0],
        );
        logMetadata = {
          source: 'sqlLab',
          source_id: editor?.id,
          db_id: editor?.dbId,
          schema: editor?.schema,
          ...logMetadata,
        };
      }

      let finalEventData: LogEventData = {
        ...logMetadata,
        ts: new Date().getTime(),
        event_name: eventName,
        ...eventData,
      } as LogEventData;

      if (LOG_EVENT_TYPE_TIMING.has(eventName)) {
        finalEventData = {
          ...finalEventData,
          event_type: 'timing',
          trigger_event: lastEventId,
        };
      } else {
        lastEventId = nanoid();
        finalEventData = {
          ...finalEventData,
          event_type: 'user',
          event_id: lastEventId,
          visibility: document.visibilityState,
        };
      }

      if (
        finalEventData.target_id &&
        dashboardLayout?.present?.[finalEventData.target_id as string]
      ) {
        const { meta } =
          dashboardLayout.present[finalEventData.target_id as string];
        // chart name or tab/header text
        finalEventData.target_name = meta.chartId ? meta.sliceName : meta.text;
      }

      logMessageQueue.append(finalEventData);
      return finalEventData;
    };
  };

export default loggerMiddleware;
