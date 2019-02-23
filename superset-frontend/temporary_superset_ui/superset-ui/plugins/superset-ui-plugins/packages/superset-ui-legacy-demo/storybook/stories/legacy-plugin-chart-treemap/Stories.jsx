/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="treemap"
        chartProps={{
          formData: {
            colorScheme: 'd3Category10',
            numberFormat: '.3s',
            treeMapRatio: 1.618033988749895,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-treemap|TreemapChartPlugin',
  },
];
