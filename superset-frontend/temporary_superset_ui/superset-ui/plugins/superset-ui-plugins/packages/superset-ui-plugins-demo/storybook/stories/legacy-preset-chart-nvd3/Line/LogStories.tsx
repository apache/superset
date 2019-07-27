/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import dummyDatasource from '../../../shared/dummyDatasource';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="line"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          richTooltip: true,
          vizType: 'line',
          yAxisBounds: [1, 60000],
          yAxisFormat: ',d',
          yLogScale: true,
        }}
      />
    ),
    storyName: 'Log scale',
    storyPath: 'legacy-|preset-chart-nvd3|LineChartPlugin',
  },
];
