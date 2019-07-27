/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="horizon"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          horizonColorScale: 'series',
          seriesHeight: '25',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-horizon|HorizonChartPlugin',
  },
];
