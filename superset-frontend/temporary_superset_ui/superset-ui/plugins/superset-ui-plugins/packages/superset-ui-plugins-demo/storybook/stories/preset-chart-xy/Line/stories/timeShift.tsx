/* eslint-disable no-magic-numbers, sort-keys */
import * as React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from '../data/data2';
import { LINE_PLUGIN_TYPE } from '../constants';
import dummyDatasource from '../../../../shared/dummyDatasource';

export default [
  {
    renderStory: () => [
      <SuperChart
        key="line1"
        chartType={LINE_PLUGIN_TYPE}
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          encoding: {
            x: {
              field: 'x',
              type: 'temporal',
              format: '%Y',
              scale: {
                type: 'time',
              },
              axis: {
                orient: 'bottom',
                title: 'Time',
              },
            },
            y: {
              field: 'y',
              type: 'quantitative',
              scale: {
                type: 'linear',
              },
              axis: {
                orient: 'left',
                title: 'Score',
              },
            },
            stroke: {
              value: '#1abc9c',
              type: 'nominal',
              scale: false,
            },
            fill: {
              field: 'snapshot',
              type: 'nominal',
              scale: {
                type: 'ordinal',
                domain: ['Current', 'Last year'],
                range: [true, false],
              },
              legend: false,
            },
            strokeDasharray: {
              field: 'snapshot',
              type: 'nominal',
              scale: {
                type: 'ordinal',
                domain: ['Current', 'Last year'],
                range: [null, '4 4'],
              },
              legend: false,
            },
            strokeWidth: {
              field: 'snapshot',
              type: 'nominal',
              scale: {
                type: 'ordinal',
                domain: ['Current', 'Last year'],
                range: [3, 1.5],
              },
              legend: false,
            },
          },
        }}
      />,
    ],
    storyName: 'with time shift',
    storyPath: 'preset-chart-xy|LineChartPlugin',
  },
];
