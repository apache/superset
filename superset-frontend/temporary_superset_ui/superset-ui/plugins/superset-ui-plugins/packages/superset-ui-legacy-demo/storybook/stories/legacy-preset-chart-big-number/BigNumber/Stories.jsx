/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="big-number"
        chartProps={{
          formData: {
            colorPicker: {
              r: 0,
              g: 122,
              b: 135,
              a: 1,
            },
            compareLag: 1,
            compareSuffix: 'over 10Y',
            metric: 'sum__SP_POP_TOTL',
            showTrendLine: true,
            startYAxisAtZero: true,
            vizType: 'big_number',
            yAxisFormat: '.3s',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'preset-chart-big-number|BigNumberChartPlugin',
  },
];
