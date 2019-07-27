/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="chord"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          colorScheme: 'd3Category10',
          yAxisFormat: '.2f',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-chord|ChordChartPlugin',
  },
];
