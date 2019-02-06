/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="big-number"
        chartProps={{
          formData: {},
          height: 400,
          payload: {
            data: [],
          },
          width: 400,
        }}
      />
    ),
    storyName: 'BigNumberChartPlugin',
    storyPath: 'plugin-chart-big-number',
  },
];
