/* eslint-disable no-magic-numbers, sort-keys */
import * as React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from '../data/data';
import { LINE_PLUGIN_TYPE } from '../constants';
import dummyDatasource from '../../../../shared/dummyDatasource';

const missingData = data.map(({ y, ...rest }) => ({
  ...rest,
  y: Math.random() < 0.25 ? null : y,
}));

export default [
  {
    renderStory: () => [
      <SuperChart
        key="line1"
        chartType={LINE_PLUGIN_TYPE}
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data: missingData }}
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
              field: 'name',
              type: 'nominal',
              scale: {},
              legend: true,
            },
          },
        }}
      />,
    ],
    storyName: 'with missing data',
    storyPath: 'preset-chart-xy|LineChartPlugin',
  },
];
