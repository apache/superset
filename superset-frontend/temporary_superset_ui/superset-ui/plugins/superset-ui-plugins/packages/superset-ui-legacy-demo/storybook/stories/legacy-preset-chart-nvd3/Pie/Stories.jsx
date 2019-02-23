/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="pie"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            colorScheme: 'd3Category10',
            donut: false,
            labelsOutside: true,
            numberFormat: '.3s',
            pieLabelType: 'key',
            showLabels: true,
            showLegend: true,
            vizType: 'pie',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-nvd3|PieChartPlugin',
  },
];
