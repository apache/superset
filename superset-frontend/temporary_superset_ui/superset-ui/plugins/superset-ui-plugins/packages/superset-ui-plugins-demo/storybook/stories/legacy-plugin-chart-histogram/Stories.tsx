/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="histogram"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          colorScheme: 'd3Category10',
          globalOpacity: 1,
          linkLength: 15, // binCount
          normalized: false,
          xAxisLabel: 'Score',
          yAxisLabel: 'Count',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-histogram|HistogramChartPlugin',
  },
];
