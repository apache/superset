/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import dummyDatasource from '../../shared/dummyDatasource';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="partition"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
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
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-partition|PartitionChartPlugin',
  },
];
