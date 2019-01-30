/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="<%= packageName %>"
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
    storyName: '<%= packageLabel %>ChartPlugin',
    storyPath: 'plugin-chart-<%= packageName %>',
  },
];
