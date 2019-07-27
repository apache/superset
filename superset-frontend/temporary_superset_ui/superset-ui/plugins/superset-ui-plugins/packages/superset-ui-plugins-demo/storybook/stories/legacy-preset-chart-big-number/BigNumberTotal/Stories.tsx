/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="big-number-total"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          metric: 'sum__num',
          subheader: 'total female participants',
          vizType: 'big_number_total',
          yAxisFormat: '.3s',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-big-number|BigNumberTotalChartPlugin',
  },
];
