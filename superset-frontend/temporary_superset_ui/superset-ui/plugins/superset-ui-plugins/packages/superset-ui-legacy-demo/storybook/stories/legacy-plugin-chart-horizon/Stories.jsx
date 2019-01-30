/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="horizon"
        chartProps={{
          formData: {},
          height: 600,
          payload: {
            data: [],
          },
          width: 600,
        }}
      />
    ),
    storyName: 'HorizonChartPlugin',
    storyPath: 'plugin-chart-horizon',
  },
];
