import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="iframe"
        width={400}
        height={400}
        formData={{
          url: 'https://www.youtube.com/embed/AdSZJzb-aX8',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-iframe|IframeChartPlugin',
  },
];
