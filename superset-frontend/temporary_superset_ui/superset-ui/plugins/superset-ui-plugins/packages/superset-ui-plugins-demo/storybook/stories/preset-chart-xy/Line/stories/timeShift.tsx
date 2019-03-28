/* eslint-disable no-magic-numbers, sort-keys */
import * as React from 'react';
import { SuperChart, ChartProps } from '@superset-ui/chart';
import data from '../data/data2';
import { LINE_PLUGIN_TYPE } from '../constants';

export default [
  {
    renderStory: () => [
      <SuperChart
        key="line1"
        chartType={LINE_PLUGIN_TYPE}
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
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
                color: {
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
              },
            },
            height: 400,
            payload: { data },
            width: 400,
          })
        }
      />,
    ],
    storyName: 'with time shift',
    storyPath: 'preset-chart-xy|LineChartPlugin',
  },
];
