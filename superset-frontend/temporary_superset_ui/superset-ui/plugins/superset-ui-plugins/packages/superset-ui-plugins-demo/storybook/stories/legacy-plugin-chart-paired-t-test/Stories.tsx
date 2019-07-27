/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="paired-t-test"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          groupby: ['name'],
          liftvaluePrecision: 4,
          metrics: ['sum__num'],
          pvaluePrecision: 6,
          significanceLevel: 0.05,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-paired-t-test|PairedTTestChartPlugin',
  },
];
