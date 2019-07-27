/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="sunburst"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          colorScheme: 'd3Category10',
          metric: 'sum__SP_POP_TOTL',
          secondaryMetric: 'sum__SP_RUR_TOTL',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-sunburst|SunburstChartPlugin',
  },
];
