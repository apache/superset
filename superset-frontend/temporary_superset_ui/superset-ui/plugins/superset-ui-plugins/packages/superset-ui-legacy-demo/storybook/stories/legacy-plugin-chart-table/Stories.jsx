/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import 'bootstrap/dist/css/bootstrap.min.css';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="table"
        chartProps={{
          datasource: {
            columnFormats: {},
            verboseMap: {
              name: 'name',
              sum__num: 'sum__num',
            },
          },
          filters: {},
          formData: {
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
          },
          height: 400,
          payload: {
            data: {
              columns: ['name', 'sum__num'],
              records: [
                {
                  name: 'Michael',
                  sum__num: 2467063,
                },
                {
                  name: 'Christopher',
                  sum__num: 1725265,
                },
                {
                  name: 'David',
                  sum__num: 1570516,
                },
                {
                  name: 'James',
                  sum__num: 1506025,
                },
                {
                  name: 'John',
                  sum__num: 1426074,
                },
                {
                  name: 'Matthew',
                  sum__num: 1355803,
                },
                {
                  name: 'Robert',
                  sum__num: 1314800,
                },
                {
                  name: 'Daniel',
                  sum__num: 1159354,
                },
                {
                  name: 'Joseph',
                  sum__num: 1114098,
                },
                {
                  name: 'William',
                  sum__num: 1113701,
                },
              ],
            },
          },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-table|TableChartPlugin',
  },
];
