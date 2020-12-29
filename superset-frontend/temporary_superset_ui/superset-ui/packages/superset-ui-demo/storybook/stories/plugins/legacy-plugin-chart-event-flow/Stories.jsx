import React from 'react';
import { SuperChart } from '@superset-ui/core';
import sampleEvents from '@data-ui/event-flow/build/sampleEvents';
import EventFlowChartPlugin from '@superset-ui/legacy-plugin-chart-event-flow';

new EventFlowChartPlugin().configure({ key: 'event-flow' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-event-flow',
};

const data = sampleEvents.twentyUsers.allEvents.map(({ ENTITY_ID, EVENT_NAME, TS }) => ({
  __timestamp: TS,
  eventName: EVENT_NAME,
  userId: ENTITY_ID,
}));

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
