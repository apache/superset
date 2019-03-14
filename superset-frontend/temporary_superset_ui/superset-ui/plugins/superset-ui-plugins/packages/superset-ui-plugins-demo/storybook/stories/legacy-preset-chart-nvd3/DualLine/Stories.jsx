/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

const reverseData = data.map(series => ({
  ...series,
  yAxis: series.yAxis === 1 ? 2 : 1,
}));

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="dual-line"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            colorScheme: 'd3Category10',
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
    storyPath: 'legacy-|preset-chart-nvd3|DualLineChartPlugin',
  },
  {
    renderStory: () => (
      <div>
        <SuperChart
          chartType="dual-line"
          chartProps={{
            datasource: { verboseMap: {} },
            formData: {
              colorScheme: 'd3Category10',
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
        <SuperChart
          chartType="dual-line"
          chartProps={{
            datasource: { verboseMap: {} },
            formData: {
              colorScheme: 'd3Category10',
              vizType: 'dual_line',
              xAxisFormat: 'smart_date',
              yAxis2Format: '.3s',
              yAxisFormat: '.3s',
            },
            height: 400,
            payload: { data: reverseData },
            width: 400,
          }}
        />
      </div>
    ),
    storyName: 'Swap y-axis with consistent color',
    storyPath: 'legacy-|preset-chart-nvd3|DualLineChartPlugin',
  },
];
