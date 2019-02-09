/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="compare"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            bottomMargin: 'auto',
            colorScheme: 'd3Category10',
            contribution: false,
            leftMargin: 'auto',
            vizType: 'compare',
            xAxisFormat: 'smart_date',
            xAxisLabel: '',
            xAxisShowminmax: false,
            xTicksLayout: 'auto',
            yAxisBounds: [null, null],
            yAxisFormat: '.3s',
            yAxisLabel: '',
            yAxisShowminmax: false,
            yLogscale: false,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'preset-chart-nvd3|CompareChartPlugin',
  },
];
