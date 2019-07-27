/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import 'bootstrap/dist/css/bootstrap.min.css';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="table"
        width={400}
        height={400}
        datasource={{
          columnFormats: {},
          verboseMap: {
            name: 'name',
            sum__num: 'sum__num',
          },
        }}
        filters={{}}
        payload={{ data }}
        formData={{
          alignPn: false,
          colorPn: false,
          includeSearch: false,
          metrics: ['sum__num'],
          orderDesc: true,
          pageLength: 0,
          percentMetrics: [],
          tableFilter: false,
          tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
          timeseriesLimitMetric: null,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-table|TableChartPlugin',
  },
];
