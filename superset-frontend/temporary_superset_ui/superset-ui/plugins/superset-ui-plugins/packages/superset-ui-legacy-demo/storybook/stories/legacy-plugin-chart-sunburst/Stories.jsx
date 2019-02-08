/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="sunburst"
        chartProps={{
          formData: {
            colorScheme: 'd3Category10',
            metric: 'sum__SP_POP_TOTL',
            secondaryMetric: 'sum__SP_RUR_TOTL',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-sunburst|SunburstChartPlugin',
  },
];
