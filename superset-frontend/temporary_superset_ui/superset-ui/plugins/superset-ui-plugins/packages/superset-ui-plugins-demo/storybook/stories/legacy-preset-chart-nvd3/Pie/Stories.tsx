/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import dummyDatasource from '../../../shared/dummyDatasource';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="pie"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          colorScheme: 'd3Category10',
          donut: false,
          labelsOutside: true,
          numberFormat: '.3s',
          pieLabelType: 'key',
          showLabels: true,
          showLegend: true,
          vizType: 'pie',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-nvd3|PieChartPlugin',
  },
];
