/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="line"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            richTooltip: true,
            vizType: 'line',
            yAxisBounds: [1, 60000],
            yAxisFormat: ',d',
            yLogScale: true,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Log scale',
    storyPath: 'legacy-|preset-chart-nvd3|LineChartPlugin',
  },
];
