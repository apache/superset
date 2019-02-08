/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="big-number-total"
        chartProps={{
          formData: {
            metric: 'sum__num',
            subheader: 'total female participants',
            vizType: 'big_number_total',
            yAxisFormat: '.3s',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'preset-chart-big-number|BigNumberTotalChartPlugin',
  },
];
