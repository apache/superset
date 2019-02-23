/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="histogram"
        chartProps={{
          formData: {
            colorScheme: 'd3Category10',
            globalOpacity: 1,
            linkLength: 25,
            normalized: false,
            xAxisLabel: 'Score',
            yAxisLabel: 'Count',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-histogram|HistogramChartPlugin',
  },
];
