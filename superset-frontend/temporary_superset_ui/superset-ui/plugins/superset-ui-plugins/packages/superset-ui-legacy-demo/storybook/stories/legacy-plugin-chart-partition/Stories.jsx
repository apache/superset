/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="partition"
        chartProps={{
          datasource: {
            verboseMap: {},
          },
          formData: {
            colorScheme: 'd3Category10',
            dateTimeFormat: '%Y-%m-%d',
            equalDateSize: true,
            groupby: ['region', 'country_code'],
            logScale: false,
            metrics: ['sum__SP_POP_TOTL'],
            numberFormat: '.3s',
            partitionLimit: '5',
            partitionThreshold: '0.05',
            richTooltip: true,
            timeSeriesOption: 'not-time',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-partition|PartitionChartPlugin',
  },
];
