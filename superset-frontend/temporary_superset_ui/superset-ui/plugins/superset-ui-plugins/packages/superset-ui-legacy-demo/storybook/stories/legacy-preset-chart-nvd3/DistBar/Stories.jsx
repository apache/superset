/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="dist-bar"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            barstacked: false,
            bottomMargin: 'auto',
            colorScheme: 'd3Category10',
            contribution: false,
            orderBars: false,
            reduceXTicks: false,
            showBarValue: false,
            showControls: false,
            showLegend: true,
            vizType: 'dist_bar',
            xAxisLabel: 'ddd',
            xTicksLayout: 'auto',
            yAxisFormat: '.3s',
            yAxisLabel: 'ddd',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'preset-chart-nvd3|DistBarChartPlugin',
  },
];
