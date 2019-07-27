/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import dummyDatasource from '../../../shared/dummyDatasource';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="box-plot"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          colorScheme: 'd3Category10',
          vizType: 'box_plot',
          whiskerOptions: 'Min/max (no outliers)',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-nvd3|BoxPlotChartPlugin',
  },
];
