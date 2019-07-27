/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import dummyDatasource from '../../../shared/dummyDatasource';

const reverseData = data.map(series => ({
  ...series,
  yAxis: series.yAxis === 1 ? 2 : 1,
}));

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="dual-line"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          colorScheme: 'd3Category10',
          vizType: 'dual_line',
          xAxisFormat: 'smart_date',
          yAxis2Format: '.3s',
          yAxisFormat: '.3s',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-nvd3|DualLineChartPlugin',
  },
  {
    renderStory: () => (
      <div>
        <SuperChart
          chartType="dual-line"
          width={400}
          height={400}
          datasource={dummyDatasource}
          payload={{ data }}
          formData={{
            colorScheme: 'd3Category10',
            vizType: 'dual_line',
            xAxisFormat: 'smart_date',
            yAxis2Format: '.3s',
            yAxisFormat: '.3s',
          }}
        />
        <SuperChart
          chartType="dual-line"
          width={400}
          height={400}
          datasource={dummyDatasource}
          payload={{ data: reverseData }}
          formData={{
            colorScheme: 'd3Category10',
            vizType: 'dual_line',
            xAxisFormat: 'smart_date',
            yAxis2Format: '.3s',
            yAxisFormat: '.3s',
          }}
        />
      </div>
    ),
    storyName: 'Swap y-axis with consistent color',
    storyPath: 'legacy-|preset-chart-nvd3|DualLineChartPlugin',
  },
];
