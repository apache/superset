/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="box-plot"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            colorScheme: 'd3Category10',
            vizType: 'box_plot',
            whiskerOptions: 'Min/max (no outliers)',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'preset-chart-nvd3|BoxPlotChartPlugin',
  },
];
