/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart, ChartProps } from '@superset-ui/chart';
import data from '../data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="v2-box-plot/legacy"
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
              colorScheme: 'd3Category10',
              groupby: ['region'],
              metrics: ['sum__SP_POP_TOTL'],
              vizType: 'box_plot',
              whiskerOptions: 'Min/max (no outliers)',
            },
            height: 400,
            payload: { data },
            width: 400,
          })
        }
      />
    ),
    storyName: 'Use Legacy API shim',
    storyPath: 'preset-chart-xy|BoxPlotChartPlugin',
  },
];
