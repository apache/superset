/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="word-cloud"
        width={400}
        height={400}
        queriesData={[{ data }]}
        formData={{
          colorScheme: 'd3Category10',
          metric: 'sum__num',
          rotation: 'square',
          series: 'name',
          sizeFrom: '10',
          sizeTo: '70',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-word-cloud|WordCloudChartPlugin',
  },
];
