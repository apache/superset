/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

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
          payload: {
            data: [
              {
                sum__num: 32546308,
              },
            ],
          },
          width: 400,
        }}
      />
    ),
    storyName: 'BigNumberTotalChartPlugin',
    storyPath: 'plugin-chart-big-number-total',
  },
];
