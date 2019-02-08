/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="rose"
        chartProps={{
          formData: {
            colorScheme: 'd3Category10',
            dateTimeFormat: '%Y-%m-%d',
            numberFormat: '.3s',
            richTooltip: true,
            roseAreaProportion: false,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-rose|RoseChartPlugin',
  },
];
