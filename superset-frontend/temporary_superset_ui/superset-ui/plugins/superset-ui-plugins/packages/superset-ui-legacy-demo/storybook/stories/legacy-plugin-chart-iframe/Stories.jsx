import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="iframe"
        chartProps={{
          formData: {
            url: 'https://www.youtube.com/embed/AdSZJzb-aX8',
          },
          height: 600,
        }}
      />
    ),
    storyName: 'IframeChartPlugin',
    storyPath: 'plugin-chart-iframe',
  },
];
