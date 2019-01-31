/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import sampleEvents from '@data-ui/event-flow/build/sampleEvents';

const data = sampleEvents.twentyUsers.allEvents.map(({ ENTITY_ID, EVENT_NAME, TS }) => ({
  __timestamp: TS,
  eventName: EVENT_NAME,
  userId: ENTITY_ID,
}));

console.log('data', data);

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="event-flow"
        chartProps={{
          formData: {
            allColumnsX: 'eventName',
            entity: 'userId',
            minLeafNodeEventCount: 1,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'EventFlowChartPlugin',
    storyPath: 'plugin-chart-event-flow',
  },
];
