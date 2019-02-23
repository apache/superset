/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="world-map"
        chartProps={{
          formData: {
            maxBubbleSize: '25',
            showBubbles: true,
          },
          height: 400,
          payload: {
            data,
          },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-world-map|WorldMapChartPlugin',
  },
];
