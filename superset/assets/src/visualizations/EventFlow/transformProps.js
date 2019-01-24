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
  cleanEvents,
  TS,
  EVENT_NAME,
  ENTITY_ID,
} from '@data-ui/event-flow';

export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const {
    allColumnsX,
    entity,
    minLeafNodeEventCount,
  } = formData;
  const { data } = payload;

  const hasData = data && data.length > 0;
  if (hasData) {
    const userKey = entity;
    const eventNameKey = allColumnsX;

    // map from the Superset form fields to <EventFlow />'s expected data keys
    const accessorFunctions = {
      [TS]: datum => new Date(datum.__timestamp), // eslint-disable-line no-underscore-dangle
      [EVENT_NAME]: datum => datum[eventNameKey],
      [ENTITY_ID]: datum => String(datum[userKey]),
    };

    const cleanData = cleanEvents(data, accessorFunctions);
    return {
      data: cleanData,
      initialMinEventCount: minLeafNodeEventCount,
    };
  }
  return { data: null };
}
