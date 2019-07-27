/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="world-map"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          maxBubbleSize: '25',
          showBubbles: true,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-world-map|WorldMapChartPlugin',
  },
];
