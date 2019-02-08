/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="paired-t-test"
        chartProps={{
          formData: {
            groupby: ['name'],
            liftvaluePrecision: 4,
            metrics: ['sum__num'],
            pvaluePrecision: 6,
            significanceLevel: 0.05,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-paired-t-test|PairedTTestChartPlugin',
  },
];
