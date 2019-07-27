/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import dummyDatasource from '../../../shared/dummyDatasource';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="dist-bar"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
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
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-nvd3|DistBarChartPlugin',
  },
];
