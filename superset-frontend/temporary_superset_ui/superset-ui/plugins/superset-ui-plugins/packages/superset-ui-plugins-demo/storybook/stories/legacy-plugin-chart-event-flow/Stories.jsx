/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import sampleEvents from '@data-ui/event-flow/build/sampleEvents';

const data = sampleEvents.twentyUsers.allEvents.map(({ ENTITY_ID, EVENT_NAME, TS }) => ({
  __timestamp: TS,
  eventName: EVENT_NAME,
  userId: ENTITY_ID,
}));

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="event-flow"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          allColumnsX: 'eventName',
          entity: 'userId',
          minLeafNodeEventCount: 1,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-event-flow|EventFlowChartPlugin',
  },
];
