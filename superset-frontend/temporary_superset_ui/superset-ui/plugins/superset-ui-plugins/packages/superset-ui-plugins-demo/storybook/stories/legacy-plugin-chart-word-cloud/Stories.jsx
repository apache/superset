/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="word-cloud"
        chartProps={{
          formData: {
            colorScheme: 'd3Category10',
            metric: 'sum__num',
            rotation: 'square',
            series: 'name',
            sizeFrom: '10',
            sizeTo: '70',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-word-cloud|WordCloudChartPlugin',
  },
];
