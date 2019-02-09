/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="dual-line"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            colorScheme: 'd3Category10',
            metric: 'avg__num',
            metric2: 'sum__num',
            vizType: 'dual_line',
            xAxisFormat: 'smart_date',
            yAxis2Format: '.3s',
            yAxisFormat: '.3s',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'preset-chart-nvd3|DualLineChartPlugin',
  },
];
