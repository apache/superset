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

import { safeStringify } from '../utils/safeStringify';
import { LOG_EVENT } from '../logger/actions';
import { LOG_EVENT_TYPE_TIMING } from '../logger/LogUtils';
import DebouncedMessageQueue from '../utils/DebouncedMessageQueue';

const LOG_ENDPOINT = '/superset/log/?explode=events';
const sendBeacon = events => {
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
    if (SupersetClient.getGuestToken()) {
      // if we have a guest token, we need to send it for auth via the form
      formData.append('guest_token', SupersetClient.getGuestToken());
    }
    navigator.sendBeacon(endpoint, formData);
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
const logMessageQueue = new DebouncedMessageQueue({
  callback: sendBeacon,
  sizeThreshold: MAX_EVENTS_PER_REQUEST,
  delayThreshold: 1000,
});
let lastEventId = 0;
const loggerMiddleware = store => next => action => {
  if (action.type !== LOG_EVENT) {
    return next(action);
  }

  const { dashboardInfo, explore, impressionId, dashboardLayout, sqlLab } =
    store.getState();
  let logMetadata = {
    impression_id: impressionId,
    version: 'v2',
  };
  if (dashboardInfo?.id) {
    logMetadata = {
      source: 'dashboard',
      source_id: dashboardInfo.id,
      ...logMetadata,
    };
  } else if (explore?.slice) {
    logMetadata = {
      source: 'explore',
      source_id: explore.slice ? explore.slice.slice_id : 0,
      ...logMetadata,
    };
  } else if (sqlLab) {
    const editor = sqlLab.queryEditors.find(
      ({ id }) => id === sqlLab.tabHistory.slice(-1)[0],
    );
    logMetadata = {
      source: 'sqlLab',
      source_id: editor?.id,
      db_id: editor?.dbId,
      schema: editor?.schema,
    };
  }

  const { eventName } = action.payload;
  let { eventData = {} } = action.payload;
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

  if (eventData.target_id && dashboardLayout?.present?.[eventData.target_id]) {
    const { meta } = dashboardLayout.present[eventData.target_id];
    // chart name or tab/header text
    eventData.target_name = meta.chartId ? meta.sliceName : meta.text;
  }

  logMessageQueue.append(eventData);
  return eventData;
};

export default loggerMiddleware;
