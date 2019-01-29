/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="chord"
        chartProps={{
          formData: {
            colorScheme: 'd3Category10',
            yAxisFormat: '.2f',
          },
          height: 600,
          payload: {
            data: {
              matrix: [
                [381, 16, 14, 5, 4, 6],
                [29, 535, 132, 20, 21, 16],
                [22, 18, 1, 3, 0, 214],
                [3, 4, 462, 152, 132, 0],
                [16, 32, 299, 123, 146, 1],
                [22, 83, 53, 21, 22, 6],
              ],
              nodes: ['Hong Kong', 'Tokyo', 'Taipei', 'Beijing', 'Bangkok', 'Jakarta', 'Singapore'],
            },
          },
          width: 600,
        }}
      />
    ),
    storyName: 'ChordChartPlugin',
    storyPath: 'plugin-chart-chord',
  },
];
