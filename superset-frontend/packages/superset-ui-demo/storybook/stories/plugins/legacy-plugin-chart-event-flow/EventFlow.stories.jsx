/*
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

import React from 'react';
import { SuperChart } from '@superset-ui/core';
import sampleEvents from '@data-ui/event-flow/build/sampleEvents';
import EventFlowChartPlugin from '@superset-ui/legacy-plugin-chart-event-flow';

new EventFlowChartPlugin().configure({ key: 'event-flow' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-event-flow',
};

const data = sampleEvents.twentyUsers.allEvents.map(
  ({ ENTITY_ID, EVENT_NAME, TS }) => ({
    __timestamp: TS,
    eventName: EVENT_NAME,
    userId: ENTITY_ID,
  }),
);

export const basic = () => (
  <SuperChart
    chartType="event-flow"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      allColumnsX: 'eventName',
      entity: 'userId',
      minLeafNodeEventCount: 1,
    }}
  />
);
