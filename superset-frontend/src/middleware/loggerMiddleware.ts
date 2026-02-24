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
import { nanoid } from 'nanoid';
import { SupersetClient } from '@superset-ui/core';
import type { Middleware, Dispatch, Action } from 'redux';

import { safeStringify } from '../utils/safeStringify';
import { LOG_EVENT } from '../logger/actions';
import {
  LOG_EVENT_TYPE_TIMING,
  LOG_ACTIONS_SPA_NAVIGATION,
} from '../logger/LogUtils';
import DebouncedMessageQueue from '../utils/DebouncedMessageQueue';
import { ensureAppRoot } from '../utils/pathUtils';
import type { DashboardInfo, DashboardLayoutState } from '../dashboard/types';
import type { QueryEditor } from '../SqlLab/types';

type LogEventSource = 'dashboard' | 'explore' | 'sqlLab' | 'slice';

interface LogEventData {
  source?: LogEventSource;
  source_id?: string | number;
  dashboard_id?: number;
  slice_id?: number;
  db_id?: number;
  schema?: string;
  impression_id?: string;
  version?: string;
  ts?: number;
  event_name?: string;
  event_type?: 'timing' | 'user';
  trigger_event?: string | number;
  event_id?: string;
  visibility?: DocumentVisibilityState;
  target_id?: string;
  target_name?: string;
  path?: string;
  [key: string]: unknown;
}

interface LogEventAction extends Action<typeof LOG_EVENT> {
  type: typeof LOG_EVENT;
  payload: {
    eventName: string;
    eventData?: LogEventData;
  };
}

interface ExploreState {
  slice?: {
    slice_id?: number;
  };
}

interface SqlLabState {
  queryEditors: QueryEditor[];
  tabHistory: string[];
}

interface LoggerRootState {
  dashboardInfo?: DashboardInfo;
  explore?: ExploreState;
  impressionId?: string;
  dashboardLayout?: DashboardLayoutState;
  sqlLab?: SqlLabState;
}

interface LoggerStore {
  getState: () => LoggerRootState;
  dispatch: Dispatch;
}

const LOG_ENDPOINT = '/superset/log/?explode=events';

const sendBeacon = (events: LogEventData[]): void => {
  if (events.length <= 0) {
    return;
  }

  let endpoint = LOG_ENDPOINT;
  const [firstEvent] = events;
  const { source, source_id } = firstEvent;
  // backend logs treat these request params as first-class citizens
  if (source === 'dashboard') {
    endpoint += `&dashboard_id=${source_id}`;
  } else if (source === 'slice') {
    endpoint += `&slice_id=${source_id}`;
  }

  if (navigator.sendBeacon) {
    const formData = new FormData();
    formData.append('events', safeStringify(events));
    if (SupersetClient.getGuestToken()) {
      // if we have a guest token, we need to send it for auth via the form
      formData.append('guest_token', SupersetClient.getGuestToken() as string);
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

const loggerMiddleware: Middleware<
  Record<string, never>,
  LoggerRootState,
  Dispatch
> =
  (store: LoggerStore) =>
  (next: Dispatch) =>
  (action: Action): LogEventData | ReturnType<Dispatch> => {
    let navPath: string | undefined;

    if ((action as LogEventAction).type !== LOG_EVENT) {
      return next(action);
    }

    const logAction = action as LogEventAction;
    const { dashboardInfo, explore, impressionId, dashboardLayout, sqlLab } =
      store.getState();
    let logMetadata: LogEventData = {
      impression_id: impressionId,
      version: 'v2',
    };
    const { eventName } = logAction.payload;
    let eventData: LogEventData = logAction.payload.eventData || {};

    if (eventName === LOG_ACTIONS_SPA_NAVIGATION) {
      navPath = eventData.path;
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
      const editor = sqlLab?.queryEditors.find(
        ({ id }) => id === sqlLab.tabHistory.slice(-1)[0],
      );
      logMetadata = {
        source: 'sqlLab',
        source_id: editor?.id,
        db_id: editor?.dbId,
        schema: editor?.schema,
      };
    }

    eventData = {
      ...logMetadata,
      ts: new Date().getTime(),
      event_name: eventName,
      ...eventData,
    };
    if (LOG_EVENT_TYPE_TIMING.has(eventName)) {
      eventData = {
        ...eventData,
        event_type: 'timing',
        trigger_event: lastEventId,
      };
    } else {
      lastEventId = nanoid();
      eventData = {
        ...eventData,
        event_type: 'user',
        event_id: lastEventId,
        visibility: document.visibilityState,
      };
    }

    if (
      eventData.target_id &&
      dashboardLayout?.present?.[eventData.target_id]
    ) {
      const { meta } = dashboardLayout.present[eventData.target_id];
      // chart name or tab/header text
      eventData.target_name = meta.chartId ? meta.sliceName : meta.text;
    }

    logMessageQueue.append(eventData);
    return eventData;
  };

export default loggerMiddleware;
